from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional, List
from datetime import datetime, timezone
import logging

from models.user import User, UserRole
from models.qualification import (
    QualificationQuestion, 
    QualificationQuestionCreate, 
    QualificationSettings,
    AnswerOption,
    QualificationAnswer
)
from models.activity import LeadActivity
from routes.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/qualification", tags=["Qualification"])


async def get_db(request: Request):
    return request.app.state.db


# ============ QUALIFICATION QUESTIONS (Admin) ============

@router.get("/questions")
async def get_qualification_questions(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all qualification questions"""
    db = await get_db(request)
    questions = await db.qualification_questions.find(
        {"is_active": True}, 
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    return {"questions": questions}


@router.post("/questions")
async def create_qualification_question(
    question_data: QualificationQuestionCreate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Create a new qualification question (Admin only)"""
    db = await get_db(request)
    
    # Build options with IDs
    options = []
    for opt in question_data.options:
        options.append(AnswerOption(
            text=opt.get("text", ""),
            score=opt.get("score", 0)
        ).model_dump())
    
    question = QualificationQuestion(
        question=question_data.question,
        description=question_data.description,
        options=options,
        is_required=question_data.is_required,
        order=question_data.order
    )
    
    question_doc = question.model_dump()
    question_doc["created_at"] = question_doc["created_at"].isoformat()
    question_doc["updated_at"] = question_doc["updated_at"].isoformat()
    
    await db.qualification_questions.insert_one(question_doc)
    
    return {"message": "Question created successfully", "question_id": question.question_id}


@router.put("/questions/{question_id}")
async def update_qualification_question(
    question_id: str,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Update a qualification question (Admin only)"""
    db = await get_db(request)
    body = await request.json()
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if "question" in body:
        update_data["question"] = body["question"]
    if "description" in body:
        update_data["description"] = body["description"]
    if "options" in body:
        options = []
        for opt in body["options"]:
            options.append({
                "option_id": opt.get("option_id", f"opt_{datetime.now().timestamp()}"),
                "text": opt.get("text", ""),
                "score": opt.get("score", 0)
            })
        update_data["options"] = options
    if "is_required" in body:
        update_data["is_required"] = body["is_required"]
    if "order" in body:
        update_data["order"] = body["order"]
    
    result = await db.qualification_questions.update_one(
        {"question_id": question_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question updated successfully"}


@router.delete("/questions/{question_id}")
async def delete_qualification_question(
    question_id: str,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Soft delete a qualification question (Admin only)"""
    db = await get_db(request)
    
    result = await db.qualification_questions.update_one(
        {"question_id": question_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question deleted successfully"}


# ============ QUALIFICATION SETTINGS (Admin) ============

@router.get("/settings")
async def get_qualification_settings(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get qualification settings (threshold)"""
    db = await get_db(request)
    
    settings = await db.qualification_settings.find_one(
        {"settings_id": "qualification_settings"},
        {"_id": 0}
    )
    
    if not settings:
        # Return default settings
        return {"threshold_score": 0}
    
    return settings


@router.put("/settings")
async def update_qualification_settings(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Update qualification settings (Admin only)"""
    db = await get_db(request)
    body = await request.json()
    
    threshold_score = body.get("threshold_score", 0)
    
    settings = QualificationSettings(
        threshold_score=threshold_score,
        updated_by=current_user.user_id
    )
    
    settings_doc = settings.model_dump()
    settings_doc["updated_at"] = settings_doc["updated_at"].isoformat()
    
    await db.qualification_settings.update_one(
        {"settings_id": "qualification_settings"},
        {"$set": settings_doc},
        upsert=True
    )
    
    return {"message": "Settings updated successfully", "threshold_score": threshold_score}


# ============ LEAD QUALIFICATION ============

@router.post("/leads/{lead_id}/qualify")
async def qualify_lead(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Submit qualification answers for a lead"""
    db = await get_db(request)
    body = await request.json()
    
    # Check if lead exists
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get answers from body: [{"question_id": "...", "option_id": "..."}]
    answers_input = body.get("answers", [])
    
    # Get all questions to validate and calculate scores
    questions = await db.qualification_questions.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    question_map = {q["question_id"]: q for q in questions}
    
    # Calculate total score
    total_score = 0
    qualification_answers = []
    
    for ans in answers_input:
        question_id = ans.get("question_id")
        option_id = ans.get("option_id")
        
        if question_id not in question_map:
            continue
        
        question = question_map[question_id]
        
        # Find the selected option and its score
        score = 0
        for opt in question.get("options", []):
            if opt.get("option_id") == option_id:
                score = opt.get("score", 0)
                break
        
        total_score += score
        
        qualification_answers.append({
            "question_id": question_id,
            "option_id": option_id,
            "score": score,
            "answered_at": datetime.now(timezone.utc).isoformat(),
            "answered_by": current_user.user_id
        })
    
    # Get threshold
    settings = await db.qualification_settings.find_one(
        {"settings_id": "qualification_settings"},
        {"_id": 0}
    )
    threshold = settings.get("threshold_score", 0) if settings else 0
    
    # Determine qualification status
    is_qualified = total_score >= threshold
    
    # Update lead
    old_qualified = lead.get("is_qualified")
    old_score = lead.get("qualification_score", 0)
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {"$set": {
            "qualification_answers": qualification_answers,
            "qualification_score": total_score,
            "is_qualified": is_qualified,
            "qualified_at": datetime.now(timezone.utc).isoformat() if is_qualified else None,
            "qualified_by": current_user.user_id if is_qualified else None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log activity
    activity = LeadActivity(
        lead_id=lead_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        action="qualified" if is_qualified else "qualification_updated",
        field_changes={
            "qualification_score": {"old": old_score, "new": total_score},
            "is_qualified": {"old": old_qualified, "new": is_qualified}
        },
        notes=f"Score: {total_score}/{threshold} - {'Qualified' if is_qualified else 'Faulty'}"
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.lead_activities.insert_one(activity_doc)
    
    return {
        "lead_id": lead_id,
        "total_score": total_score,
        "threshold": threshold,
        "is_qualified": is_qualified,
        "status": "Qualified" if is_qualified else "Faulty"
    }


@router.get("/leads/{lead_id}/qualification")
async def get_lead_qualification(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get qualification status and answers for a lead"""
    db = await get_db(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get questions for context
    questions = await db.qualification_questions.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get settings
    settings = await db.qualification_settings.find_one(
        {"settings_id": "qualification_settings"},
        {"_id": 0}
    )
    threshold = settings.get("threshold_score", 0) if settings else 0
    
    return {
        "lead_id": lead_id,
        "qualification_answers": lead.get("qualification_answers", []),
        "qualification_score": lead.get("qualification_score", 0),
        "is_qualified": lead.get("is_qualified"),
        "threshold": threshold,
        "questions": questions
    }
