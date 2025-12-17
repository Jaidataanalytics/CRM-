from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timezone
import logging

from models.user import User
from models.activity import LeadActivity, FollowUp
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead-activities", tags=["Lead Activities"])


async def get_db(request: Request):
    return request.app.state.db


@router.get("/{lead_id}")
async def get_lead_activities(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    limit: int = 50
):
    """Get activity history for a lead"""
    db = await get_db(request)
    
    # Get activities
    activities = await db.lead_activities.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"activities": activities}


@router.get("/{lead_id}/followups")
async def get_lead_followups(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get follow-ups for a lead"""
    db = await get_db(request)
    
    followups = await db.lead_followups.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("followup_date", -1).to_list(100)
    
    return {"followups": followups}


@router.post("/{lead_id}/followups")
async def add_lead_followup(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Add a follow-up for a lead"""
    db = await get_db(request)
    body = await request.json()
    
    # Check if lead exists
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    followup = FollowUp(
        lead_id=lead_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        followup_date=body.get("followup_date"),
        notes=body.get("notes"),
        outcome=body.get("outcome")
    )
    
    followup_doc = followup.model_dump()
    followup_doc["created_at"] = followup_doc["created_at"].isoformat()
    
    await db.lead_followups.insert_one(followup_doc)
    
    # Update lead's last followup date
    await db.leads.update_one(
        {"lead_id": lead_id},
        {"$set": {
            "last_followup_date": body.get("followup_date"),
            "no_of_followups": (lead.get("no_of_followups") or 0) + 1,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log activity
    activity = LeadActivity(
        lead_id=lead_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        action="followup_added",
        notes=f"Follow-up scheduled for {body.get('followup_date')}: {body.get('notes', '')[:100]}"
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.lead_activities.insert_one(activity_doc)
    
    return {"message": "Follow-up added successfully", "followup_id": followup.followup_id}


async def log_lead_activity(db, lead_id: str, user_id: str, user_name: str, action: str, 
                           field_changes: dict = None, notes: str = None):
    """Helper function to log lead activity"""
    activity = LeadActivity(
        lead_id=lead_id,
        user_id=user_id,
        user_name=user_name,
        action=action,
        field_changes=field_changes,
        notes=notes
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.lead_activities.insert_one(activity_doc)
