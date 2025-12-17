from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import logging

from models.lead import Lead, LeadCreate, LeadUpdate, LeadResponse
from models.user import User, UserRole
from models.activity_log import ActivityLog
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["Leads"])


async def get_db(request: Request):
    return request.app.state.db


@router.get("")
async def get_leads(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    employee_name: Optional[str] = None,
    segment: Optional[str] = None,
    enquiry_status: Optional[str] = None,
    enquiry_stage: Optional[str] = None,
    kva_min: Optional[float] = None,
    kva_max: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """Get leads with filtering and pagination"""
    db = await get_db(request)
    
    # Build filter query
    query = {}
    
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if employee_name:
        query["employee_name"] = employee_name
    if segment:
        query["segment"] = segment
    if enquiry_status:
        query["enquiry_status"] = enquiry_status
    if enquiry_stage:
        query["enquiry_stage"] = enquiry_stage
    
    if kva_min is not None or kva_max is not None:
        query["kva"] = {}
        if kva_min is not None:
            query["kva"]["$gte"] = kva_min
        if kva_max is not None:
            query["kva"]["$lte"] = kva_max
    
    if start_date or end_date:
        query["enquiry_date"] = {}
        if start_date:
            query["enquiry_date"]["$gte"] = start_date
        if end_date:
            query["enquiry_date"]["$lte"] = end_date
    
    # Calculate skip
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.leads.count_documents(query)
    
    # Get leads
    leads = await db.leads.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get a single lead by ID"""
    db = await get_db(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return lead


@router.post("", response_model=dict)
async def create_lead(
    lead_data: LeadCreate,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create a new lead"""
    db = await get_db(request)
    
    lead = Lead(**lead_data.model_dump())
    lead_doc = lead.model_dump()
    lead_doc["created_at"] = lead_doc["created_at"].isoformat()
    lead_doc["updated_at"] = lead_doc["updated_at"].isoformat()
    lead_doc["created_by"] = current_user.user_id
    
    await db.leads.insert_one(lead_doc)
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="create",
        resource_type="lead",
        resource_id=lead.lead_id,
        details={"enquiry_no": lead.enquiry_no}
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"lead_id": lead.lead_id, "message": "Lead created successfully"}


@router.put("/{lead_id}")
async def update_lead(
    lead_id: str,
    lead_data: LeadUpdate,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Update an existing lead"""
    db = await get_db(request)
    
    # Check if lead exists
    existing_lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not existing_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Prepare update data
    update_data = {k: v for k, v in lead_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Track status changes for closure questions
    old_status = existing_lead.get("enquiry_status")
    new_status = update_data.get("enquiry_status")
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {"$set": update_data}
    )
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="update",
        resource_type="lead",
        resource_id=lead_id,
        details={
            "old_status": old_status,
            "new_status": new_status,
            "fields_updated": list(update_data.keys())
        }
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"message": "Lead updated successfully"}


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Delete a lead (Admin/Manager only)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admin or Manager can delete leads")
    
    db = await get_db(request)
    
    result = await db.leads.delete_one({"lead_id": lead_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="delete",
        resource_type="lead",
        resource_id=lead_id
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"message": "Lead deleted successfully"}
