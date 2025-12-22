from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import logging

from models.user import User, UserRole
from routes.auth import get_current_user, require_roles

router = APIRouter(prefix="/admin/trash", tags=["Admin - Trash Management"])
logger = logging.getLogger(__name__)

# Constants
RECOVERY_DAYS = 14  # Leads can be recovered within 14 days


class DeleteLeadsRequest(BaseModel):
    filters: dict  # Contains date_range, state, dealer, employee, stage, segment, source
    delete_all: bool = False


class DeletePreviewResponse(BaseModel):
    count: int
    sample_leads: List[dict]
    filters_applied: dict


async def get_db(request: Request):
    return request.app.state.db


@router.get("/preview-delete")
async def preview_delete(
    request: Request,
    delete_all: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    employee: Optional[str] = None,
    stage: Optional[str] = None,
    segment: Optional[str] = None,
    source: Optional[str] = None,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Preview leads that will be deleted based on filters"""
    db = await get_db(request)
    
    # Build filter - exclude already deleted leads
    query_filter = {"deleted_at": {"$exists": False}}
    filters_applied = {}
    
    if not delete_all:
        if start_date and end_date:
            query_filter["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
            filters_applied["date_range"] = f"{start_date} to {end_date}"
        if state:
            query_filter["state"] = state
            filters_applied["state"] = state
        if dealer:
            query_filter["dealer"] = dealer
            filters_applied["dealer"] = dealer
        if employee:
            query_filter["employee_name"] = employee
            filters_applied["employee"] = employee
        if stage:
            query_filter["enquiry_stage"] = stage
            filters_applied["stage"] = stage
        if segment:
            query_filter["segment"] = segment
            filters_applied["segment"] = segment
        if source:
            query_filter["source"] = source
            filters_applied["source"] = source
    else:
        filters_applied["delete_all"] = True
    
    # Count matching leads
    count = await db.leads.count_documents(query_filter)
    
    # Get sample of leads
    sample_leads = await db.leads.find(
        query_filter,
        {"_id": 0, "lead_id": 1, "enquiry_no": 1, "name": 1, "enquiry_date": 1, 
         "state": 1, "dealer": 1, "enquiry_stage": 1}
    ).limit(10).to_list(10)
    
    return {
        "count": count,
        "sample_leads": sample_leads,
        "filters_applied": filters_applied
    }


@router.post("/delete-leads")
async def delete_leads(
    request: Request,
    delete_all: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    employee: Optional[str] = None,
    stage: Optional[str] = None,
    segment: Optional[str] = None,
    source: Optional[str] = None,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Soft delete leads based on filters"""
    db = await get_db(request)
    
    # Build filter - exclude already deleted leads
    query_filter = {"deleted_at": {"$exists": False}}
    filters_applied = {}
    
    if not delete_all:
        if start_date and end_date:
            query_filter["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
            filters_applied["date_range"] = f"{start_date} to {end_date}"
        if state:
            query_filter["state"] = state
            filters_applied["state"] = state
        if dealer:
            query_filter["dealer"] = dealer
            filters_applied["dealer"] = dealer
        if employee:
            query_filter["employee_name"] = employee
            filters_applied["employee"] = employee
        if stage:
            query_filter["enquiry_stage"] = stage
            filters_applied["stage"] = stage
        if segment:
            query_filter["segment"] = segment
            filters_applied["segment"] = segment
        if source:
            query_filter["source"] = source
            filters_applied["source"] = source
        
        # Require at least one filter if not delete_all
        if len(filters_applied) == 0:
            raise HTTPException(
                status_code=400, 
                detail="At least one filter is required. Use delete_all=true to delete all leads."
            )
    else:
        filters_applied["delete_all"] = True
    
    # Get count before deletion
    count = await db.leads.count_documents(query_filter)
    
    if count == 0:
        return {
            "success": True,
            "deleted_count": 0,
            "message": "No leads matched the criteria"
        }
    
    # Calculate auto-purge date (14 days from now)
    auto_purge_at = (datetime.now(timezone.utc) + timedelta(days=RECOVERY_DAYS)).isoformat()
    deleted_at = datetime.now(timezone.utc).isoformat()
    
    # Soft delete by setting deleted_at field
    result = await db.leads.update_many(
        query_filter,
        {
            "$set": {
                "deleted_at": deleted_at,
                "deleted_by": current_user.user_id,
                "deleted_by_name": current_user.name,
                "auto_purge_at": auto_purge_at,
                "deletion_filters": filters_applied
            }
        }
    )
    
    # Log the activity
    await db.activity_logs.insert_one({
        "log_id": f"log_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "action": "bulk_delete_leads",
        "resource": "leads",
        "details": {
            "deleted_count": result.modified_count,
            "filters": filters_applied,
            "auto_purge_at": auto_purge_at
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"User {current_user.name} soft-deleted {result.modified_count} leads with filters: {filters_applied}")
    
    return {
        "success": True,
        "deleted_count": result.modified_count,
        "auto_purge_at": auto_purge_at,
        "message": f"Successfully moved {result.modified_count} leads to trash. They will be permanently deleted after {RECOVERY_DAYS} days."
    }


@router.get("/deleted-leads")
async def get_deleted_leads(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get all soft-deleted leads (trash)"""
    db = await get_db(request)
    
    query_filter = {"deleted_at": {"$exists": True}}
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query_filter)
    
    leads = await db.leads.find(
        query_filter,
        {"_id": 0, "lead_id": 1, "enquiry_no": 1, "name": 1, "enquiry_date": 1,
         "state": 1, "dealer": 1, "enquiry_stage": 1, "deleted_at": 1, 
         "deleted_by_name": 1, "auto_purge_at": 1, "deletion_filters": 1}
    ).sort("deleted_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.post("/recover-leads")
async def recover_leads(
    request: Request,
    lead_ids: Optional[List[str]] = Query(None),
    recover_all: bool = Query(False),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Recover soft-deleted leads"""
    db = await get_db(request)
    
    if not recover_all and (not lead_ids or len(lead_ids) == 0):
        raise HTTPException(status_code=400, detail="Provide lead_ids or set recover_all=true")
    
    if recover_all:
        query_filter = {"deleted_at": {"$exists": True}}
    else:
        query_filter = {
            "lead_id": {"$in": lead_ids},
            "deleted_at": {"$exists": True}
        }
    
    # Get count before recovery
    count = await db.leads.count_documents(query_filter)
    
    if count == 0:
        return {
            "success": True,
            "recovered_count": 0,
            "message": "No deleted leads found to recover"
        }
    
    # Remove deletion fields
    result = await db.leads.update_many(
        query_filter,
        {
            "$unset": {
                "deleted_at": "",
                "deleted_by": "",
                "deleted_by_name": "",
                "auto_purge_at": "",
                "deletion_filters": ""
            }
        }
    )
    
    # Log the activity
    await db.activity_logs.insert_one({
        "log_id": f"log_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "action": "recover_leads",
        "resource": "leads",
        "details": {
            "recovered_count": result.modified_count,
            "recover_all": recover_all,
            "lead_ids": lead_ids if not recover_all else None
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"User {current_user.name} recovered {result.modified_count} leads")
    
    return {
        "success": True,
        "recovered_count": result.modified_count,
        "message": f"Successfully recovered {result.modified_count} leads"
    }


@router.post("/permanent-delete")
async def permanent_delete_leads(
    request: Request,
    lead_ids: List[str] = None,
    delete_all_trash: bool = False,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Permanently delete leads from trash"""
    db = await get_db(request)
    
    if not delete_all_trash and (not lead_ids or len(lead_ids) == 0):
        raise HTTPException(status_code=400, detail="Provide lead_ids or set delete_all_trash=true")
    
    if delete_all_trash:
        query_filter = {"deleted_at": {"$exists": True}}
    else:
        query_filter = {
            "lead_id": {"$in": lead_ids},
            "deleted_at": {"$exists": True}
        }
    
    # Get count before deletion
    count = await db.leads.count_documents(query_filter)
    
    if count == 0:
        return {
            "success": True,
            "deleted_count": 0,
            "message": "No leads found in trash to permanently delete"
        }
    
    # Permanently delete
    result = await db.leads.delete_many(query_filter)
    
    # Log the activity
    await db.activity_logs.insert_one({
        "log_id": f"log_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "action": "permanent_delete_leads",
        "resource": "leads",
        "details": {
            "deleted_count": result.deleted_count,
            "delete_all_trash": delete_all_trash,
            "lead_ids": lead_ids if not delete_all_trash else None
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"User {current_user.name} permanently deleted {result.deleted_count} leads")
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"Permanently deleted {result.deleted_count} leads"
    }


@router.get("/trash-stats")
async def get_trash_stats(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get trash statistics"""
    db = await get_db(request)
    
    total_in_trash = await db.leads.count_documents({"deleted_at": {"$exists": True}})
    
    # Get leads expiring soon (within 3 days)
    three_days_from_now = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    expiring_soon = await db.leads.count_documents({
        "deleted_at": {"$exists": True},
        "auto_purge_at": {"$lte": three_days_from_now}
    })
    
    # Get deletion history (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_deletions = await db.activity_logs.find(
        {
            "action": "bulk_delete_leads",
            "created_at": {"$gte": seven_days_ago}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_in_trash": total_in_trash,
        "expiring_soon": expiring_soon,
        "recent_deletions": recent_deletions,
        "recovery_days": RECOVERY_DAYS
    }


@router.post("/purge-expired")
async def purge_expired_leads(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Manually purge leads past their auto-purge date"""
    db = await get_db(request)
    
    now = datetime.now(timezone.utc).isoformat()
    
    query_filter = {
        "deleted_at": {"$exists": True},
        "auto_purge_at": {"$lte": now}
    }
    
    count = await db.leads.count_documents(query_filter)
    
    if count == 0:
        return {
            "success": True,
            "purged_count": 0,
            "message": "No expired leads to purge"
        }
    
    result = await db.leads.delete_many(query_filter)
    
    # Log the activity
    await db.activity_logs.insert_one({
        "log_id": f"log_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "action": "purge_expired_leads",
        "resource": "leads",
        "details": {
            "purged_count": result.deleted_count
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"User {current_user.name} purged {result.deleted_count} expired leads")
    
    return {
        "success": True,
        "purged_count": result.deleted_count,
        "message": f"Purged {result.deleted_count} expired leads"
    }


@router.get("/filter-options")
async def get_filter_options(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get available filter options for deletion"""
    db = await get_db(request)
    
    # Get distinct values for each filter field (excluding deleted leads)
    base_filter = {"deleted_at": {"$exists": False}}
    
    states = await db.leads.distinct("state", base_filter)
    dealers = await db.leads.distinct("dealer", base_filter)
    employees = await db.leads.distinct("employee_name", base_filter)
    stages = await db.leads.distinct("enquiry_stage", base_filter)
    segments = await db.leads.distinct("segment", base_filter)
    sources = await db.leads.distinct("source", base_filter)
    
    return {
        "states": sorted([s for s in states if s]),
        "dealers": sorted([d for d in dealers if d]),
        "employees": sorted([e for e in employees if e]),
        "stages": sorted([s for s in stages if s]),
        "segments": sorted([s for s in segments if s]),
        "sources": sorted([s for s in sources if s])
    }
