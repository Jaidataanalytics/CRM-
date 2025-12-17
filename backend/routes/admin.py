from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import logging

from models.user import User, UserCreate, UserResponse, UserRole
from models.activity_log import ActivityLog
from routes.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


async def get_db(request: Request):
    return request.app.state.db


# User Management
@router.get("/users", response_model=List[UserResponse])
async def get_users(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get all users (Admin only)"""
    db = await get_db(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Update user role (Admin only)"""
    db = await get_db(request)
    body = await request.json()
    new_role = body.get("role")
    
    if new_role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Prevent self-demotion
    if user_id == current_user.user_id and new_role != UserRole.ADMIN.value:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": new_role, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="update_role",
        resource_type="user",
        resource_id=user_id,
        details={"new_role": new_role}
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"message": "User role updated successfully"}


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Activate/Deactivate user (Admin only)"""
    db = await get_db(request)
    body = await request.json()
    is_active = body.get("is_active", True)
    
    # Prevent self-deactivation
    if user_id == current_user.user_id and not is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User {'activated' if is_active else 'deactivated'} successfully"}


# Activity Logs
@router.get("/activity-logs")
async def get_activity_logs(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200)
):
    """Get activity logs (Admin only)"""
    db = await get_db(request)
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    skip = (page - 1) * limit
    total = await db.activity_logs.count_documents(query)
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get user names for the logs
    user_ids = list(set(log["user_id"] for log in logs))
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(len(user_ids))
    user_map = {u["user_id"]: u for u in users}
    
    for log in logs:
        user = user_map.get(log["user_id"], {})
        log["user_name"] = user.get("name", "Unknown")
        log["user_email"] = user.get("email", "Unknown")
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


# Lead Closure Questions Management
@router.get("/closure-questions")
async def get_closure_questions(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get lead closure questions"""
    db = await get_db(request)
    questions = await db.closure_questions.find({}, {"_id": 0}).to_list(100)
    return {"questions": questions}


@router.post("/closure-questions")
async def create_closure_question(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Create a new closure question"""
    db = await get_db(request)
    body = await request.json()
    
    import uuid
    question = {
        "question_id": f"q_{uuid.uuid4().hex[:8]}",
        "question": body.get("question"),
        "type": body.get("type", "text"),  # text, select, multiselect
        "options": body.get("options", []),
        "required": body.get("required", False),
        "applies_to": body.get("applies_to", "all"),  # all, won, lost
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.closure_questions.insert_one(question)
    return {"message": "Question created successfully", "question_id": question["question_id"]}


@router.delete("/closure-questions/{question_id}")
async def delete_closure_question(
    question_id: str,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a closure question"""
    db = await get_db(request)
    result = await db.closure_questions.delete_one({"question_id": question_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question deleted successfully"}


# Data Management
@router.delete("/leads/bulk")
async def delete_leads_bulk(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Bulk delete leads (Admin only)"""
    db = await get_db(request)
    body = await request.json()
    lead_ids = body.get("lead_ids", [])
    
    if not lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")
    
    result = await db.leads.delete_many({"lead_id": {"$in": lead_ids}})
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="bulk_delete",
        resource_type="lead",
        details={"count": result.deleted_count}
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"message": f"{result.deleted_count} leads deleted successfully"}


@router.get("/stats")
async def get_admin_stats(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get admin dashboard stats"""
    db = await get_db(request)
    
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    total_leads = await db.leads.count_documents({})
    total_activities = await db.activity_logs.count_documents({})
    
    # Users by role
    role_pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]
    role_distribution = await db.users.aggregate(role_pipeline).to_list(10)
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_leads": total_leads,
        "total_activities": total_activities,
        "role_distribution": [
            {"role": r["_id"], "count": r["count"]}
            for r in role_distribution
        ]
    }
