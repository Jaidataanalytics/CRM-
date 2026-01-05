"""
Dispatch Management Routes
Handles dispatch status tracking for won orders.
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from models.user import User, UserRole
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dispatch", tags=["Dispatch"])

# Cutoff date for determining default dispatch status
# Orders won before this date = "dispatched" by default
# Orders won on/after this date = "pending" by default
DISPATCH_CUTOFF_DATE = "2026-01-05"


async def get_db(request: Request):
    return request.app.state.db


class DispatchUpdateRequest(BaseModel):
    dispatch_status: str  # "pending" or "dispatched"
    dispatch_date: Optional[str] = None
    delivery_address: Optional[str] = None
    transporter_details: Optional[str] = None
    reason: Optional[str] = None  # Required when changing from dispatched back to pending


@router.get("/summary")
async def get_dispatch_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get summary of dispatch statuses for won orders"""
    db = await get_db(request)
    
    # Base query for won orders (Closed-Won or Order Booked)
    base_query = {
        "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
        "deleted_at": {"$exists": False}
    }
    
    if state:
        base_query["state"] = state
    if dealer:
        base_query["dealer"] = dealer
    if start_date and end_date:
        base_query["eo_po_date"] = {"$gte": start_date, "$lte": end_date}
    
    # Count pending dispatch
    pending_query = {**base_query, "dispatch_status": "pending"}
    pending_count = await db.leads.count_documents(pending_query)
    
    # Count dispatched
    dispatched_query = {**base_query, "dispatch_status": "dispatched"}
    dispatched_count = await db.leads.count_documents(dispatched_query)
    
    # Count orders without dispatch status (need migration)
    no_status_query = {**base_query, "dispatch_status": {"$exists": False}}
    no_status_count = await db.leads.count_documents(no_status_query)
    
    # Total won
    total_won = await db.leads.count_documents(base_query)
    
    return {
        "total_won": total_won,
        "pending_dispatch": pending_count,
        "dispatched": dispatched_count,
        "needs_migration": no_status_count
    }


@router.get("/list")
async def get_dispatch_list(
    request: Request,
    current_user: User = Depends(get_current_user),
    dispatch_status: Optional[str] = None,  # "pending" or "dispatched"
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """Get list of won orders with dispatch status"""
    db = await get_db(request)
    
    # Base query for won orders (Closed-Won or Order Booked)
    query = {
        "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]},
        "deleted_at": {"$exists": False}
    }
    
    if dispatch_status:
        query["dispatch_status"] = dispatch_status
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if start_date and end_date:
        query["eo_po_date"] = {"$gte": start_date, "$lte": end_date}
    
    # Search
    if search and search.strip():
        search_term = search.strip()
        query["$or"] = [
            {"name": {"$regex": search_term, "$options": "i"}},
            {"phone_number": {"$regex": search_term, "$options": "i"}},
            {"enquiry_no": {"$regex": search_term, "$options": "i"}},
            {"dealer": {"$regex": search_term, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query)
    
    leads = await db.leads.find(query, {"_id": 0}).sort("eo_po_date", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.patch("/{lead_id}")
async def update_dispatch_status(
    request: Request,
    lead_id: str,
    dispatch_data: DispatchUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update dispatch status for a won order"""
    db = await get_db(request)
    
    # Find the lead
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check if it's a won order (Closed-Won or Order Booked)
    won_stages = ["Closed-Won", "Order Booked"]
    if lead.get("enquiry_stage") not in won_stages:
        raise HTTPException(status_code=400, detail="Only won orders can have dispatch status")
    
    new_status = dispatch_data.dispatch_status
    old_status = lead.get("dispatch_status")
    
    # Validate status
    if new_status not in ["pending", "dispatched"]:
        raise HTTPException(status_code=400, detail="Invalid dispatch status. Must be 'pending' or 'dispatched'")
    
    # Check if reason is required
    # Reason is required when: was pending by default -> became dispatched -> going back to pending
    dispatch_history = lead.get("dispatch_status_history", [])
    was_dispatched_before = any(h.get("status") == "dispatched" for h in dispatch_history)
    
    # Historical data (before cutoff) doesn't require reason to change from dispatched to pending
    won_date = lead.get("eo_po_date") or lead.get("enquiry_closure_date") or "2020-01-01"
    is_historical = won_date < DISPATCH_CUTOFF_DATE
    
    if new_status == "pending" and old_status == "dispatched" and was_dispatched_before and not is_historical:
        if not dispatch_data.reason:
            raise HTTPException(
                status_code=400, 
                detail="Reason is required when changing from dispatched back to pending"
            )
    
    # Validate dispatch date
    if new_status == "dispatched" and dispatch_data.dispatch_date:
        # Dispatch date cannot be before won date
        if dispatch_data.dispatch_date < won_date:
            raise HTTPException(
                status_code=400,
                detail=f"Dispatch date cannot be before won date ({won_date})"
            )
    
    # Prepare update
    update_data = {
        "dispatch_status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == "dispatched":
        if dispatch_data.dispatch_date:
            update_data["dispatch_date"] = dispatch_data.dispatch_date
        if dispatch_data.delivery_address:
            update_data["delivery_address"] = dispatch_data.delivery_address
        if dispatch_data.transporter_details:
            update_data["transporter_details"] = dispatch_data.transporter_details
    
    # Add to history
    history_entry = {
        "status": new_status,
        "changed_at": datetime.now(timezone.utc).isoformat(),
        "changed_by": current_user.name or current_user.email,
        "changed_by_id": current_user.user_id,
        "previous_status": old_status
    }
    
    if dispatch_data.reason:
        history_entry["reason"] = dispatch_data.reason
    
    if dispatch_data.dispatch_date:
        history_entry["dispatch_date"] = dispatch_data.dispatch_date
    
    # Update the lead
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": update_data,
            "$push": {"dispatch_status_history": history_entry}
        }
    )
    
    return {
        "success": True,
        "message": f"Dispatch status updated to {new_status}",
        "lead_id": lead_id,
        "new_status": new_status
    }


@router.post("/migrate")
async def migrate_dispatch_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Migrate existing won orders to have dispatch status.
    - Orders won before cutoff date -> dispatched (no dispatch date)
    - Orders won on/after cutoff date -> pending
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can run migration")
    
    db = await get_db(request)
    
    # Find won orders without dispatch status
    query = {
        "enquiry_stage": "Closed-Won",
        "dispatch_status": {"$exists": False}
    }
    
    leads_to_migrate = await db.leads.find(query, {"lead_id": 1, "eo_po_date": 1, "enquiry_closure_date": 1}).to_list(10000)
    
    historical_count = 0
    new_count = 0
    
    for lead in leads_to_migrate:
        won_date = lead.get("eo_po_date") or lead.get("enquiry_closure_date") or "2020-01-01"
        
        if won_date < DISPATCH_CUTOFF_DATE:
            # Historical - set to dispatched without date
            await db.leads.update_one(
                {"lead_id": lead["lead_id"]},
                {
                    "$set": {
                        "dispatch_status": "dispatched",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            historical_count += 1
        else:
            # New - set to pending
            await db.leads.update_one(
                {"lead_id": lead["lead_id"]},
                {
                    "$set": {
                        "dispatch_status": "pending",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            new_count += 1
    
    return {
        "success": True,
        "message": "Migration completed",
        "historical_set_dispatched": historical_count,
        "new_set_pending": new_count,
        "total_migrated": historical_count + new_count
    }


@router.get("/{lead_id}/history")
async def get_dispatch_history(
    request: Request,
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get dispatch status change history for a lead"""
    db = await get_db(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"dispatch_status_history": 1, "dispatch_status": 1, "dispatch_date": 1})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {
        "lead_id": lead_id,
        "current_status": lead.get("dispatch_status"),
        "dispatch_date": lead.get("dispatch_date"),
        "history": lead.get("dispatch_status_history", [])
    }
