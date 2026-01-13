from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import logging
import io

from models.lead import Lead, LeadCreate, LeadUpdate, LeadResponse
from models.user import User, UserRole
from models.activity_log import ActivityLog
from models.activity import LeadActivity
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["Leads"])


# Bulk delete limits by role
BULK_DELETE_LIMITS = {
    UserRole.ADMIN: 10000,  # Essentially unlimited
    UserRole.MANAGER: 500,
}


class BulkDeleteRequest(BaseModel):
    lead_ids: Optional[List[str]] = None  # Specific lead IDs to delete
    select_all_matching: bool = False  # If true, delete all leads matching filters
    # Filters (only used when select_all_matching is True)
    state: Optional[str] = None
    dealer: Optional[str] = None
    employee_name: Optional[str] = None
    segment: Optional[str] = None
    enquiry_status: Optional[str] = None
    enquiry_stage: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    search: Optional[str] = None


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
    enquiry_type: Optional[str] = None,
    kva_min: Optional[float] = None,
    kva_max: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    followup_start_date: Optional[str] = None,
    followup_end_date: Optional[str] = None,
    only_open_followups: Optional[bool] = None,
    search: Optional[str] = None,
    search_field: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=10000),
    # KPI Navigation parameters (aliases for frontend compatibility)
    stage: Optional[str] = None,  # Maps to enquiry_stage
    status: Optional[str] = None,  # Maps to enquiry_status
    lead_type: Optional[str] = None  # Maps to enquiry_type
):
    """Get leads with filtering, search, and pagination"""
    db = await get_db(request)
    
    # Handle KPI navigation parameter aliases
    if stage and not enquiry_stage:
        enquiry_stage = stage
    if status and not enquiry_status:
        enquiry_status = status
    if lead_type and not enquiry_type:
        enquiry_type = lead_type
    
    # Build filter query - exclude soft-deleted leads, transferred leads, AND duplicates
    query = {
        "deleted_at": {"$exists": False},
        "$and": [
            {"$or": [
                {"is_transferred": {"$exists": False}},
                {"is_transferred": False},
                {"is_transferred": None}
            ]},
            {"$or": [
                {"is_duplicate": {"$exists": False}},
                {"is_duplicate": False},
                {"is_duplicate": None}
            ]}
        ]
    }
    
    # Search functionality
    if search and search.strip():
        search_term = search.strip()
        if search_field and search_field in ['name', 'phone_number', 'email_address', 'enquiry_no', 'dealer', 'state', 'employee_name']:
            # Search in specific field
            query[search_field] = {"$regex": search_term, "$options": "i"}
        else:
            # Search in multiple fields - need to use $and to combine with existing query
            search_or = [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"phone_number": {"$regex": search_term, "$options": "i"}},
                {"email_address": {"$regex": search_term, "$options": "i"}},
                {"enquiry_no": {"$regex": search_term, "$options": "i"}},
                {"dealer": {"$regex": search_term, "$options": "i"}},
                {"state": {"$regex": search_term, "$options": "i"}},
                {"employee_name": {"$regex": search_term, "$options": "i"}}
            ]
            # Combine with existing query using $and
            query = {
                "$and": [
                    {"deleted_at": {"$exists": False}},
                    {"$or": [{"is_transferred": {"$exists": False}}, {"is_transferred": False}, {"is_transferred": None}]},
                    {"$or": [{"is_duplicate": {"$exists": False}}, {"is_duplicate": False}, {"is_duplicate": None}]},
                    {"$or": search_or}
                ]
            }
    
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
    
    # Filter by enquiry_type (Hot/Warm/Cold) - supports multiple values comma-separated
    if enquiry_type:
        types = [t.strip() for t in enquiry_type.split(',') if t.strip()]
        if len(types) == 1:
            query["enquiry_type"] = types[0]
        elif len(types) > 1:
            query["enquiry_type"] = {"$in": types}
    
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
    
    # Filter by follow-up date range
    if followup_start_date or followup_end_date:
        query["planned_followup_date"] = {}
        if followup_start_date:
            query["planned_followup_date"]["$gte"] = followup_start_date
        if followup_end_date:
            query["planned_followup_date"]["$lte"] = followup_end_date
    
    # Only show open leads when filtering by follow-up (can't follow up on closed leads)
    if only_open_followups:
        query["enquiry_status"] = "Open"
    
    # Calculate skip
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.leads.count_documents(query)
    
    # Get leads - sorted by created_at descending (newest first)
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/dropdown-options")
async def get_dropdown_options(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get distinct values for dropdown fields"""
    db = await get_db(request)
    
    fields = ['state', 'dealer', 'employee_name', 'segment', 'customer_type', 
              'enquiry_status', 'enquiry_type', 'enquiry_stage', 'source', 'zone', 'area']
    
    options = {}
    for field in fields:
        values = await db.leads.distinct(field)
        # Filter out None, empty strings, and 'nan'
        options[field] = sorted([v for v in values if v and str(v).lower() not in ['none', 'nan', '']])
    
    # Add static options for new fields
    options['call_status'] = [
        'Not Called',
        'Called - No Response',
        'Called - Interested',
        'Called - Not Interested',
        'Called - Follow Up Required',
        'Called - Converted'
    ]
    
    return options


@router.get("/users-list")
async def get_users_for_dropdown(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get list of users for dropdown (accessible by all authenticated users)"""
    db = await get_db(request)
    
    # Get all active users
    users = await db.users.find(
        {"is_active": {"$ne": False}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    ).to_list(1000)
    
    return users


@router.get("/export")
async def export_leads(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None,
    dealer: Optional[str] = None,
    segment: Optional[str] = None,
    enquiry_status: Optional[str] = None,
    enquiry_stage: Optional[str] = None,
    enquiry_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    followup_start_date: Optional[str] = None,
    followup_end_date: Optional[str] = None,
    only_open_followups: Optional[bool] = None,
    format: str = Query("xlsx", regex="^(xlsx|csv)$")
):
    """Export leads to Excel or CSV"""
    import pandas as pd
    
    db = await get_db(request)
    
    # Build filter query - exclude soft-deleted leads
    query = {"deleted_at": {"$exists": False}}
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if segment:
        query["segment"] = segment
    if enquiry_status:
        query["enquiry_status"] = enquiry_status
    if enquiry_stage:
        query["enquiry_stage"] = enquiry_stage
    
    # Filter by enquiry_type (Hot/Warm/Cold) - supports multiple values comma-separated
    if enquiry_type:
        types = [t.strip() for t in enquiry_type.split(',') if t.strip()]
        if len(types) == 1:
            query["enquiry_type"] = types[0]
        elif len(types) > 1:
            query["enquiry_type"] = {"$in": types}
    
    if start_date or end_date:
        query["enquiry_date"] = {}
        if start_date:
            query["enquiry_date"]["$gte"] = start_date
        if end_date:
            query["enquiry_date"]["$lte"] = end_date
    
    # Filter by follow-up date range
    if followup_start_date or followup_end_date:
        query["planned_followup_date"] = {}
        if followup_start_date:
            query["planned_followup_date"]["$gte"] = followup_start_date
        if followup_end_date:
            query["planned_followup_date"]["$lte"] = followup_end_date
    
    # Only show open leads when filtering by follow-up (can't follow up on closed leads)
    if only_open_followups:
        query["enquiry_status"] = "Open"
    
    # Get leads (max 50000 for export)
    leads = await db.leads.find(query, {"_id": 0}).to_list(50000)
    
    if not leads:
        raise HTTPException(status_code=404, detail="No leads found matching criteria")
    
    # Convert to DataFrame
    df = pd.DataFrame(leads)
    
    # Reorder columns for better readability
    column_order = [
        'enquiry_no', 'enquiry_date', 'name', 'phone_number', 'email_address',
        'zone', 'state', 'area', 'dealer', 'employee_name',
        'customer_type', 'segment', 'kva', 'qty',
        'enquiry_status', 'enquiry_type', 'enquiry_stage',
        'planned_followup_date', 'last_followup_date',
        'source', 'remarks'
    ]
    
    # Keep only columns that exist in data
    existing_cols = [c for c in column_order if c in df.columns]
    other_cols = [c for c in df.columns if c not in column_order and c not in ['lead_id', 'created_at', 'updated_at', 'created_by']]
    df = df[existing_cols + other_cols]
    
    # Create file
    output = io.BytesIO()
    
    if format == "xlsx":
        df.to_excel(output, index=False, sheet_name='Leads')
        output.seek(0)
        filename = f"leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        df.to_csv(output, index=False)
        output.seek(0)
        filename = f"leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        media_type = "text/csv"
    
    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/template")
async def download_template(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Download lead upload template"""
    import pandas as pd
    
    # Template columns with sample data
    template_data = {
        'Zone': ['East', 'West'],
        'State': ['Bihar', 'Maharashtra'],
        'Area Office': ['Patna', 'Mumbai'],
        'Dealer': ['Dealer Name', 'Another Dealer'],
        'Branch': ['Branch Name', 'Branch 2'],
        'Location': ['Location', 'Location 2'],
        'Employee Code': ['EMP001', 'EMP002'],
        'Employee Name': ['John Doe', 'Jane Smith'],
        'Employee Status': ['Active', 'Active'],
        'Enquiry No': ['E2504XXX00001', 'E2504XXX00002'],
        'Enquiry Date': ['2025-04-01', '2025-04-02'],
        'Customer Type': ['New Customer', 'Existing Customer'],
        'Corporate Name': ['', 'ABC Corp'],
        'Name': ['Customer Name', 'Customer 2'],
        'Phone Number': ['9876543210', '9876543211'],
        'Email': ['email@example.com', 'email2@example.com'],
        'Address': ['Address Line', 'Address 2'],
        'PinCode': ['800001', '400001'],
        'Tehsil': ['', ''],
        'District': ['Patna', 'Mumbai'],
        'KVA': [100, 250],
        'Phase': ['Three', 'Single'],
        'Qty': [1, 2],
        'Remarks': ['Sample remarks', 'Notes'],
        'EnquiryStatus': ['Open', 'Open'],
        'EnquiryType': ['Hot', 'Warm'],
        'Enquiry Stage': ['Prospecting', 'Qualified'],
        'Planned Followup Date': ['2025-04-15', '2025-04-20'],
        'Source': ['India Mart', 'Cold Call'],
        'Segment': ['Corporate', 'Retail'],
        'SubSegment': ['', ''],
        'DG Ownership': ['First time buyer', 'Replacement'],
    }
    
    df = pd.DataFrame(template_data)
    
    output = io.BytesIO()
    df.to_excel(output, index=False, sheet_name='Lead Template')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=lead_upload_template.xlsx"}
    )


# Duplicate Leads Endpoints - MUST be before /{lead_id} route
@router.get("/duplicates/count")
async def get_duplicate_leads_count(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get count of duplicate leads"""
    db = await get_db(request)
    
    count = await db.leads.count_documents({
        "is_duplicate": True,
        "deleted_at": {"$exists": False}
    })
    
    return {"count": count}


@router.get("/duplicates")
async def get_duplicate_leads(
    request: Request,
    current_user: User = Depends(get_current_user),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """Get all leads flagged as duplicates"""
    db = await get_db(request)
    
    query = {
        "is_duplicate": True,
        "deleted_at": {"$exists": False}
    }
    
    # Search functionality
    if search and search.strip():
        search_term = search.strip()
        query["$or"] = [
            {"name": {"$regex": search_term, "$options": "i"}},
            {"phone_number": {"$regex": search_term, "$options": "i"}},
            {"enquiry_no": {"$regex": search_term, "$options": "i"}},
            {"employee_name": {"$regex": search_term, "$options": "i"}},
            {"corporate_name": {"$regex": search_term, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query)
    
    leads = await db.leads.find(query, {"_id": 0}).sort("duplicate_detected_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.post("/duplicates/{lead_id}/unflag")
async def unflag_duplicate(
    lead_id: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Remove duplicate flag from a lead (manual override)"""
    from models.user import UserRole
    
    # Only admin/manager can unflag duplicates
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admin or Manager can unflag duplicates")
    
    db = await get_db(request)
    
    result = await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "is_duplicate": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "original_lead_id": "",
                "duplicate_detected_at": ""
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {"message": "Duplicate flag removed", "lead_id": lead_id}


@router.post("/duplicates/run-detection")
async def run_duplicate_detection(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Manually trigger duplicate detection on all leads"""
    from models.user import UserRole
    from utils.duplicate_detector import run_duplicate_detection_migration
    
    # Only admin can run detection
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admin can run duplicate detection")
    
    db = await get_db(request)
    
    try:
        result = await run_duplicate_detection_migration(db)
        return {
            "success": True,
            "message": "Duplicate detection complete",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run duplicate detection: {str(e)}")


@router.get("/merge-history")
async def get_merge_history(
    request: Request,
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None
):
    """
    Get leads that have been merged/consolidated from multiple sources.
    These are leads that have duplicate_enquiry_nos (alternative enquiry numbers from merged records)
    or have been updated from multiple upload batches.
    """
    db = await get_db(request)
    
    # Build query for merged leads - leads with alternative enquiry numbers
    query = {
        "deleted_at": {"$exists": False},
        "$or": [
            {"duplicate_enquiry_nos": {"$exists": True, "$ne": [], "$ne": None}},
            {"merged_from": {"$exists": True, "$ne": [], "$ne": None}}
        ]
    }
    
    # Add search filter
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"name": search_regex},
                {"phone_number": search_regex},
                {"enquiry_no": search_regex},
                {"corporate_name": search_regex}
            ]
        }]
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query)
    
    leads = await db.leads.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Format response with merge info
    formatted_leads = []
    for lead in leads:
        duplicate_enquiry_nos = lead.get("duplicate_enquiry_nos", []) or []
        merged_from = lead.get("merged_from", []) or []
        
        formatted_leads.append({
            **lead,
            "merge_count": len(duplicate_enquiry_nos) + len(merged_from),
            "alternative_enquiry_nos": duplicate_enquiry_nos,
            "has_merged_data": bool(duplicate_enquiry_nos or merged_from)
        })
    
    return {
        "leads": formatted_leads,
        "total": total,
        "pages": (total + limit - 1) // limit,
        "page": page
    }


@router.get("/merge-history/summary")
async def get_merge_history_summary(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get summary statistics for merged/consolidated leads"""
    db = await get_db(request)
    
    # Count leads with merged data
    total_merged = await db.leads.count_documents({
        "deleted_at": {"$exists": False},
        "$or": [
            {"duplicate_enquiry_nos": {"$exists": True, "$ne": [], "$ne": None}},
            {"merged_from": {"$exists": True, "$ne": [], "$ne": None}}
        ]
    })
    
    # Aggregate to count total alternative enquiry numbers
    pipeline = [
        {
            "$match": {
                "deleted_at": {"$exists": False},
                "duplicate_enquiry_nos": {"$exists": True, "$ne": [], "$ne": None}
            }
        },
        {
            "$project": {
                "alt_count": {"$size": {"$ifNull": ["$duplicate_enquiry_nos", []]}}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_alternatives": {"$sum": "$alt_count"}
            }
        }
    ]
    result = await db.leads.aggregate(pipeline).to_list(1)
    total_alternatives = result[0]["total_alternatives"] if result else 0
    
    return {
        "total_merged_leads": total_merged,
        "total_alternative_enquiry_nos": total_alternatives,
        "consolidation_ratio": round(total_alternatives / total_merged, 2) if total_merged > 0 else 0
    }


# ============ QUOTATIONS ENDPOINTS ============
@router.get("/quotations")
async def get_quotations(
    request: Request,
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    status: str = Query("all", enum=["all", "pending", "won", "lost"]),
    search: Optional[str] = None
):
    """Get leads with quotations sent"""
    from routes.kpis import get_indian_fy_dates
    db = await get_db(request)
    start_date, end_date = get_indian_fy_dates()
    
    # Base query - leads with quotation_sent=True OR quotation_no exists OR quotation_date exists
    query = {
        "deleted_at": {"$exists": False},
        "$or": [
            {"quotation_sent": True},
            {"quotation_no": {"$exists": True, "$ne": None, "$ne": ""}},
            {"quotation_date": {"$exists": True, "$ne": None, "$ne": ""}}
        ]
    }
    
    # Filter by status
    if status == "pending":
        query["enquiry_stage"] = {"$nin": ["Closed-Won", "Order Booked", "Closed-Lost", "Lost"]}
    elif status == "won":
        query["enquiry_stage"] = {"$in": ["Closed-Won", "Order Booked"]}
    elif status == "lost":
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"enquiry_stage": {"$regex": "^Closed-", "$options": "i"}},
                {"enquiry_stage": {"$regex": "^Lost$", "$options": "i"}}
            ]
        }]
        query["enquiry_stage"] = {"$nin": ["Closed-Won", "Order Booked"]}
    
    # Add search filter
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"name": search_regex},
                {"phone_number": search_regex},
                {"quotation_no": search_regex},
                {"enquiry_no": search_regex},
                {"corporate_name": search_regex}
            ]
        }]
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query)
    
    leads = await db.leads.find(query, {"_id": 0}).sort("quotation_date", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add quotation_status field based on enquiry_stage
    for lead in leads:
        stage = lead.get("enquiry_stage", "").lower()
        if stage in ["closed-won", "order booked"]:
            lead["quotation_status"] = "won"
        elif stage.startswith("closed-") or stage == "lost":
            lead["quotation_status"] = "lost"
        else:
            lead["quotation_status"] = "pending"
    
    return {
        "quotations": leads,
        "total": total,
        "pages": (total + limit - 1) // limit,
        "page": page
    }


@router.get("/quotations/summary")
async def get_quotations_summary(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get quotation summary statistics"""
    from routes.kpis import get_indian_fy_dates
    db = await get_db(request)
    start_date, end_date = get_indian_fy_dates()
    
    # Base query for quotations
    base_query = {
        "deleted_at": {"$exists": False},
        "$or": [
            {"quotation_sent": True},
            {"quotation_no": {"$exists": True, "$ne": None, "$ne": ""}},
            {"quotation_date": {"$exists": True, "$ne": None, "$ne": ""}}
        ]
    }
    
    total = await db.leads.count_documents(base_query)
    
    # Won quotations
    won = await db.leads.count_documents({
        **base_query,
        "enquiry_stage": {"$in": ["Closed-Won", "Order Booked"]}
    })
    
    # Lost quotations (Closed-* except Won, or Lost)
    lost_query = {
        **base_query,
        "$and": [
            {"$or": [
                {"enquiry_stage": {"$regex": "^Closed-", "$options": "i"}},
                {"enquiry_stage": {"$regex": "^Lost$", "$options": "i"}}
            ]},
            {"enquiry_stage": {"$nin": ["Closed-Won", "Order Booked"]}}
        ]
    }
    lost = await db.leads.count_documents(lost_query)
    
    # Pending = Total - Won - Lost
    pending = total - won - lost
    if pending < 0:
        pending = 0
    
    # Conversion rate
    conversion_rate = round((won / total) * 100, 1) if total > 0 else 0
    
    return {
        "total": total,
        "pending": pending,
        "won": won,
        "lost": lost,
        "conversion_rate": conversion_rate
    }


# Closure Questions Endpoints - MUST be before /{lead_id} route
@router.get("/pending-closure-questions/count")
async def get_pending_closure_questions_count(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get count of leads pending closure questions"""
    db = await get_db(request)
    
    count = await db.leads.count_documents({
        "needs_closure_questions": True,
        "deleted_at": {"$exists": False}
    })
    
    return {"count": count}


@router.get("/pending-closure-questions")
async def get_leads_pending_closure_questions(
    request: Request,
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """Get leads that need closure questions answered"""
    db = await get_db(request)
    
    query = {
        "needs_closure_questions": True,
        "deleted_at": {"$exists": False}
    }
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query)
    
    leads = await db.leads.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


# Bulk Delete Endpoints - MUST be before /{lead_id} route
@router.post("/bulk-delete/preview")
async def preview_bulk_delete(
    request: Request,
    body: BulkDeleteRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Preview leads that will be deleted by bulk delete operation.
    Returns count and sample of leads that match the criteria.
    """
    # Check role permission
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admin or Manager can bulk delete leads")
    
    db = await get_db(request)
    
    # Get the delete limit for this user's role
    delete_limit = BULK_DELETE_LIMITS.get(current_user.role, 0)
    
    # Build query
    query = {
        "deleted_at": {"$exists": False},
        "$or": [
            {"is_duplicate": {"$exists": False}},
            {"is_duplicate": False},
            {"is_duplicate": None}
        ]
    }
    
    if body.lead_ids and len(body.lead_ids) > 0:
        # Specific lead IDs
        query["lead_id"] = {"$in": body.lead_ids}
    elif body.select_all_matching:
        # Build filter query
        if body.state:
            query["state"] = body.state
        if body.dealer:
            query["dealer"] = body.dealer
        if body.employee_name:
            query["employee_name"] = body.employee_name
        if body.segment:
            query["segment"] = body.segment
        if body.enquiry_status:
            query["enquiry_status"] = body.enquiry_status
        if body.enquiry_stage:
            query["enquiry_stage"] = body.enquiry_stage
        if body.start_date and body.end_date:
            query["enquiry_date"] = {"$gte": body.start_date, "$lte": body.end_date}
        elif body.start_date:
            query["enquiry_date"] = {"$gte": body.start_date}
        elif body.end_date:
            query["enquiry_date"] = {"$lte": body.end_date}
        if body.search:
            query["$or"] = [
                {"name": {"$regex": body.search, "$options": "i"}},
                {"phone_number": {"$regex": body.search, "$options": "i"}},
                {"enquiry_no": {"$regex": body.search, "$options": "i"}}
            ]
    else:
        raise HTTPException(status_code=400, detail="Must provide lead_ids or set select_all_matching=true with filters")
    
    # Count total matching
    total_count = await db.leads.count_documents(query)
    
    # Check limit
    exceeds_limit = total_count > delete_limit
    
    # Get sample leads (first 10)
    sample_leads = await db.leads.find(query, {"_id": 0, "lead_id": 1, "name": 1, "phone_number": 1, "enquiry_no": 1, "enquiry_date": 1, "state": 1}).limit(10).to_list(10)
    
    return {
        "total_count": total_count,
        "delete_limit": delete_limit,
        "exceeds_limit": exceeds_limit,
        "can_delete": total_count <= delete_limit and total_count > 0,
        "sample_leads": sample_leads,
        "message": f"Found {total_count} leads matching criteria" + (f". Limit is {delete_limit}." if exceeds_limit else "")
    }


@router.post("/bulk-delete")
async def bulk_delete_leads(
    request: Request,
    body: BulkDeleteRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Bulk soft delete leads. Admin can delete up to 10000, Manager up to 500.
    """
    # Check role permission
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Only Admin or Manager can bulk delete leads")
    
    db = await get_db(request)
    
    # Get the delete limit for this user's role
    delete_limit = BULK_DELETE_LIMITS.get(current_user.role, 0)
    
    # Build query
    query = {
        "deleted_at": {"$exists": False},
        "$or": [
            {"is_duplicate": {"$exists": False}},
            {"is_duplicate": False},
            {"is_duplicate": None}
        ]
    }
    
    if body.lead_ids and len(body.lead_ids) > 0:
        # Specific lead IDs
        if len(body.lead_ids) > delete_limit:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete more than {delete_limit} leads at once. You selected {len(body.lead_ids)}."
            )
        query["lead_id"] = {"$in": body.lead_ids}
    elif body.select_all_matching:
        # Build filter query
        if body.state:
            query["state"] = body.state
        if body.dealer:
            query["dealer"] = body.dealer
        if body.employee_name:
            query["employee_name"] = body.employee_name
        if body.segment:
            query["segment"] = body.segment
        if body.enquiry_status:
            query["enquiry_status"] = body.enquiry_status
        if body.enquiry_stage:
            query["enquiry_stage"] = body.enquiry_stage
        if body.start_date and body.end_date:
            query["enquiry_date"] = {"$gte": body.start_date, "$lte": body.end_date}
        elif body.start_date:
            query["enquiry_date"] = {"$gte": body.start_date}
        elif body.end_date:
            query["enquiry_date"] = {"$lte": body.end_date}
        if body.search:
            query["$or"] = [
                {"name": {"$regex": body.search, "$options": "i"}},
                {"phone_number": {"$regex": body.search, "$options": "i"}},
                {"enquiry_no": {"$regex": body.search, "$options": "i"}}
            ]
    else:
        raise HTTPException(status_code=400, detail="Must provide lead_ids or set select_all_matching=true with filters")
    
    # Count total matching
    total_count = await db.leads.count_documents(query)
    
    if total_count == 0:
        raise HTTPException(status_code=404, detail="No leads found matching criteria")
    
    if total_count > delete_limit:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete more than {delete_limit} leads at once. Found {total_count} matching leads. Please narrow your selection."
        )
    
    # Perform soft delete
    now = datetime.now(timezone.utc).isoformat()
    result = await db.leads.update_many(
        query,
        {
            "$set": {
                "deleted_at": now,
                "deleted_by": current_user.user_id,
                "updated_at": now
            }
        }
    )
    
    deleted_count = result.modified_count
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="bulk_delete",
        resource_type="lead",
        details={
            "deleted_count": deleted_count,
            "filters": {
                "lead_ids": body.lead_ids[:10] if body.lead_ids else None,
                "select_all_matching": body.select_all_matching,
                "state": body.state,
                "dealer": body.dealer,
                "employee_name": body.employee_name,
                "segment": body.segment,
                "start_date": body.start_date,
                "end_date": body.end_date
            }
        }
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {
        "success": True,
        "message": f"Successfully deleted {deleted_count} leads",
        "deleted_count": deleted_count
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
    
    # Auto-set added_by to current user's name if not provided
    if not lead_doc.get("added_by"):
        lead_doc["added_by"] = current_user.name or current_user.email
    
    # Auto-set enquiry_date to today if not provided
    if not lead_doc.get("enquiry_date"):
        lead_doc["enquiry_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
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


class CallRemarkRequest(BaseModel):
    remark: str


@router.post("/{lead_id}/call-remark")
async def add_call_remark(
    request: Request,
    lead_id: str,
    remark_data: CallRemarkRequest,
    current_user: User = Depends(get_current_user)
):
    """Add a call remark to a lead"""
    db = await get_db(request)
    
    # Check if lead exists
    lead = await db.leads.find_one({"lead_id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Create remark object with timestamp
    new_remark = {
        "remark": remark_data.remark,
        "added_by": current_user.name,
        "added_by_id": current_user.user_id,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to call_remarks array
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$push": {"call_remarks": new_remark},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="add_call_remark",
        resource_type="lead",
        resource_id=lead_id
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"message": "Call remark added successfully", "remark": new_remark}


@router.get("/{lead_id}/call-remarks")
async def get_call_remarks(
    request: Request,
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all call remarks for a lead"""
    db = await get_db(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"call_remarks": 1})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {"remarks": lead.get("call_remarks", [])}



# Lead Transfer Endpoints
@router.post("/{lead_id}/transfer")
async def transfer_lead_to_dealer(
    request: Request,
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Transfer any lead to dealer (mark as transferred)"""
    db = await get_db(request)
    
    # Find the lead
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check if already transferred
    if lead.get("is_transferred"):
        raise HTTPException(status_code=400, detail="Lead is already transferred")
    
    # Mark as transferred
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "is_transferred": True,
                "transferred_at": datetime.now(timezone.utc),
                "transferred_by": current_user.name or current_user.email,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Log the activity
    activity = {
        "activity_id": f"activity_{datetime.now(timezone.utc).timestamp()}",
        "resource": "lead",
        "resource_id": lead_id,
        "action": "transferred",
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "details": {"message": "Lead transferred to dealer"},
        "created_at": datetime.now(timezone.utc)
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "Lead transferred successfully", "lead_id": lead_id}


@router.post("/{lead_id}/untransfer")
async def untransfer_lead(
    request: Request,
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Reverse transfer - bring lead back from transferred status"""
    db = await get_db(request)
    
    # Find the lead
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check if lead is transferred
    if not lead.get("is_transferred"):
        raise HTTPException(status_code=400, detail="Lead is not transferred")
    
    # Remove transfer status
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "is_transferred": False,
                "updated_at": datetime.now(timezone.utc)
            },
            "$unset": {
                "transferred_at": "",
                "transferred_by": ""
            }
        }
    )
    
    # Log the activity
    activity = {
        "activity_id": f"activity_{datetime.now(timezone.utc).timestamp()}",
        "resource": "lead",
        "resource_id": lead_id,
        "action": "untransferred",
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "details": {"message": "Lead transfer reversed"},
        "created_at": datetime.now(timezone.utc)
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "Lead transfer reversed", "lead_id": lead_id}


@router.get("/transferred/list")
async def get_transferred_leads(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """Get all transferred leads"""
    db = await get_db(request)
    
    query = {
        "is_transferred": True,
        "deleted_at": {"$exists": False}
    }
    
    # Date filter on enquiry_date
    if start_date and end_date:
        query["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
    
    # Search
    if search and search.strip():
        search_term = search.strip()
        query["$or"] = [
            {"name": {"$regex": search_term, "$options": "i"}},
            {"phone_number": {"$regex": search_term, "$options": "i"}},
            {"enquiry_no": {"$regex": search_term, "$options": "i"}},
            {"employee_name": {"$regex": search_term, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    total = await db.leads.count_documents(query)
    
    leads = await db.leads.find(query, {"_id": 0}).sort("transferred_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/transferred/stats")
async def get_transferred_stats(
    request: Request,
    current_user: User = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get transferred leads statistics"""
    db = await get_db(request)
    
    query = {
        "is_transferred": True,
        "deleted_at": {"$exists": False}
    }
    
    # Date filter on enquiry_date
    if start_date and end_date:
        query["enquiry_date"] = {"$gte": start_date, "$lte": end_date}
    
    total_transferred = await db.leads.count_documents(query)
    
    # Get by employee breakdown
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$employee_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    by_employee = await db.leads.aggregate(pipeline).to_list(10)
    
    return {
        "total_transferred": total_transferred,
        "by_employee": [{"employee": e["_id"] or "Unknown", "count": e["count"]} for e in by_employee]
    }



# Closure Questions Endpoints
class ClosureAnswersRequest(BaseModel):
    answers: List[dict]  # [{question_id, question, answer}]


@router.post("/{lead_id}/closure-answers")
async def save_closure_answers(
    request: Request,
    lead_id: str,
    answers_data: ClosureAnswersRequest,
    current_user: User = Depends(get_current_user)
):
    """Save closure question answers for a lost lead"""
    db = await get_db(request)
    
    # Check if lead exists
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Save the answers
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "closure_answers": answers_data.answers,
                "closure_answers_submitted_at": datetime.now(timezone.utc).isoformat(),
                "closure_answers_submitted_by": current_user.name or current_user.email,
                "needs_closure_questions": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="closure_answers_submitted",
        resource_type="lead",
        resource_id=lead_id,
        details={"answers_count": len(answers_data.answers)}
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {"message": "Closure answers saved successfully"}
