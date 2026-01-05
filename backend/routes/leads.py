from fastapi import APIRouter, HTTPException, Request, Depends, Query
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
    limit: int = Query(50, ge=1, le=10000)
):
    """Get leads with filtering, search, and pagination"""
    db = await get_db(request)
    
    # Build filter query - exclude soft-deleted leads AND transferred leads
    query = {
        "deleted_at": {"$exists": False},
        "$or": [
            {"is_transferred": {"$exists": False}},
            {"is_transferred": False},
            {"is_transferred": None}
        ]
    }
    
    # Search functionality
    if search and search.strip():
        search_term = search.strip()
        if search_field and search_field in ['name', 'phone_number', 'email_address', 'enquiry_no', 'dealer', 'state', 'employee_name']:
            # Search in specific field
            query[search_field] = {"$regex": search_term, "$options": "i"}
        else:
            # Search in multiple fields - need to use $and to combine with existing $or
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



# BDM Transfer Endpoints
@router.post("/{lead_id}/transfer")
async def transfer_lead_to_dealer(
    request: Request,
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Transfer a BDM lead to dealer (mark as transferred)"""
    db = await get_db(request)
    
    # Find the lead
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check if lead belongs to BDM dealer
    if lead.get("dealer", "").upper() != "BDM":
        raise HTTPException(status_code=400, detail="Only BDM leads can be transferred")
    
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
