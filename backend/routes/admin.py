from fastapi import APIRouter, HTTPException, Request, Depends, Query, UploadFile, File
from typing import Optional, List
from datetime import datetime, timezone
import logging
import io

from models.user import User, UserCreate, UserResponse, UserRole
from models.activity_log import ActivityLog
from models.lead import Lead
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


# Column mapping from Excel to database fields (supports multiple variations)
COLUMN_MAPPING = {
    # Zone
    "Zone": "zone",
    "zone": "zone",
    # State
    "State": "state",
    "state": "state",
    # Area/Office variations
    "Area": "area",
    "area": "area",
    "Office": "office",
    "office": "office",
    "Area Office": "area",
    "area office": "area",
    # Dealer
    "Dealer": "dealer",
    "dealer": "dealer",
    # Branch
    "Branch": "branch",
    "branch": "branch",
    # Location/Address
    "Location": "location",
    "location": "location",
    "Address": "address",
    "address": "address",
    # Employee fields
    "Employee Code": "employee_code",
    "employee code": "employee_code",
    "Employee Name": "employee_name",
    "employee name": "employee_name",
    "Employee Status": "employee_status",
    "employee status": "employee_status",
    # Enquiry fields
    "Enquiry No": "enquiry_no",
    "enquiry no": "enquiry_no",
    "Enquiry Date": "enquiry_date",
    "enquiry date": "enquiry_date",
    # Customer fields
    "Customer Type": "customer_type",
    "customer type": "customer_type",
    "Corporate Name": "corporate_name",
    "corporate name": "corporate_name",
    "Name": "name",
    "name": "name",
    "Phone Number": "phone_number",
    "phone number": "phone_number",
    "Phone": "phone_number",
    "phone": "phone_number",
    "Email Address": "email_address",
    "email address": "email_address",
    "Email": "email_address",
    "email": "email_address",
    "PinCode": "pincode",
    "pincode": "pincode",
    "Pin Code": "pincode",
    "Tehsil": "tehsil",
    "tehsil": "tehsil",
    "District": "district",
    "district": "district",
    # Product fields
    "KVA": "kva",
    "kva": "kva",
    "Phase": "phase",
    "phase": "phase",
    "Qty": "qty",
    "qty": "qty",
    "Quantity": "qty",
    "Remarks": "remarks",
    "remarks": "remarks",
    # Status fields
    "EnquiryStatus": "enquiry_status",
    "Enquiry Status": "enquiry_status",
    "enquiry status": "enquiry_status",
    "EnquiryType": "enquiry_type",
    "Enquiry Type": "enquiry_type",
    "enquiry type": "enquiry_type",
    "Enquiry Stage": "enquiry_stage",
    "enquiry stage": "enquiry_stage",
    # Date fields
    "EO/PO Date": "eo_po_date",
    "eo/po date": "eo_po_date",
    "Planned Followup Date": "planned_followup_date",
    "planned followup date": "planned_followup_date",
    "LastFollowupDate": "last_followup_date",
    "Last Followup Date": "last_followup_date",
    "last followup date": "last_followup_date",
    "Enquiry Closure Date": "enquiry_closure_date",
    "enquiry closure date": "enquiry_closure_date",
    # Source fields
    "Source": "source",
    "source": "source",
    "Source From": "source_from",
    "source from": "source_from",
    "Events": "events",
    "events": "events",
    "No of Follow-ups": "no_of_followups",
    "no of follow-ups": "no_of_followups",
    "Followups": "no_of_followups",
    # Segment fields
    "Segment": "segment",
    "segment": "segment",
    "SubSegment": "sub_segment",
    "sub segment": "sub_segment",
    "Sub Segment": "sub_segment",
    "DG Ownership": "dg_ownership",
    "dg ownership": "dg_ownership",
    # Other fields
    "Created By": "created_by",
    "created by": "created_by",
    "PAN NO.": "pan_no",
    "pan no.": "pan_no",
    "PAN": "pan_no",
    "Finance Required": "finance_required",
    "finance required": "finance_required",
    "Finance Company": "finance_company",
    "finance company": "finance_company",
    "Referred By": "referred_by",
    "referred by": "referred_by"
}


def clean_value(val):
    """Clean and convert value"""
    if val is None or (isinstance(val, float) and str(val) == 'nan'):
        return None
    if isinstance(val, str):
        val = val.strip()
        if val == '' or val.lower() == 'nan':
            return None
    return val


def parse_date(val):
    """Parse date value to string format"""
    import pandas as pd
    
    if val is None:
        return None
    
    # Handle pandas NaT
    if pd.isna(val):
        return None
    
    # Handle datetime objects
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    
    # Handle pandas Timestamp
    if hasattr(val, 'strftime'):
        try:
            return val.strftime("%Y-%m-%d")
        except:
            return None
    
    # Handle string dates
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        
        # Try multiple date formats
        date_formats = [
            "%Y-%m-%d",           # 2023-04-01
            "%d-%m-%Y",           # 01-04-2023
            "%d/%m/%Y",           # 01/04/2023
            "%Y/%m/%d",           # 2023/04/01
            "%d %b %Y",           # 01 Apr 2023
            "%d %B %Y",           # 01 April 2023
            "%b %d, %Y",          # Apr 01, 2023
            "%B %d, %Y",          # April 01, 2023
            "%d-%b-%Y",           # 01-Apr-2023
            "%d-%B-%Y",           # 01-April-2023
            "%m/%d/%Y",           # 04/01/2023
            "%m-%d-%Y",           # 04-01-2023
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        
        # If no format matched, try pandas to_datetime as fallback
        try:
            parsed = pd.to_datetime(val, dayfirst=True)
            if pd.notna(parsed):
                return parsed.strftime("%Y-%m-%d")
        except:
            pass
        
        return None
    
    return None


@router.post("/upload-historical-data")
async def upload_historical_data(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Upload historical lead data. This will:
    1. Parse the Excel file to find the date range
    2. Delete all existing leads with enquiry_date up to the max date in the file
    3. Insert all leads from the uploaded file
    """
    db = await get_db(request)
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        import pandas as pd
        import uuid as uuid_module
        
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        
        # Find the date column (try multiple variations)
        date_column = None
        date_column_variations = [
            "Enquiry Date", "enquiry_date", "Enquiry date", "ENQUIRY DATE",
            "Date", "date", "DATE", "EnquiryDate", "enquirydate"
        ]
        for col in date_column_variations:
            if col in df.columns:
                date_column = col
                break
        
        # If still not found, try to find any column with 'date' in the name
        if not date_column:
            for col in df.columns:
                if 'date' in col.lower() and 'enquiry' in col.lower():
                    date_column = col
                    break
        
        if not date_column:
            raise HTTPException(status_code=400, detail="No 'Enquiry Date' column found in file. Expected columns: Enquiry Date, enquiry_date, etc.")
        
        # Parse all dates and find min/max
        dates = []
        for val in df[date_column]:
            parsed = parse_date(val)
            if parsed:
                dates.append(parsed)
        
        if not dates:
            raise HTTPException(status_code=400, detail="No valid dates found in the file")
        
        min_date = min(dates)
        max_date = max(dates)
        
        # Delete existing leads within the date range (up to max date)
        delete_result = await db.leads.delete_many({
            "enquiry_date": {"$lte": max_date}
        })
        deleted_count = delete_result.deleted_count
        
        # Insert new leads
        created_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                lead_data = {}
                
                for excel_col, db_field in COLUMN_MAPPING.items():
                    if excel_col in df.columns:
                        val = row[excel_col]
                        
                        if db_field in ['enquiry_date', 'eo_po_date', 'planned_followup_date', 
                                       'last_followup_date', 'enquiry_closure_date']:
                            lead_data[db_field] = parse_date(val)
                        elif db_field == 'kva':
                            cleaned = clean_value(val)
                            if cleaned is not None:
                                try:
                                    lead_data[db_field] = float(cleaned)
                                except (ValueError, TypeError):
                                    lead_data[db_field] = None
                            else:
                                lead_data[db_field] = None
                        elif db_field in ['qty', 'no_of_followups']:
                            cleaned = clean_value(val)
                            if cleaned is not None:
                                try:
                                    lead_data[db_field] = int(float(cleaned))
                                except (ValueError, TypeError):
                                    lead_data[db_field] = None
                            else:
                                lead_data[db_field] = None
                        else:
                            cleaned = clean_value(val)
                            # Convert to string if not None to avoid type issues
                            if cleaned is not None:
                                lead_data[db_field] = str(cleaned) if not isinstance(cleaned, str) else cleaned
                            else:
                                lead_data[db_field] = None
                
                # Create lead document directly without Pydantic validation to avoid issues
                import uuid as uuid_mod
                lead_doc = {
                    "lead_id": f"lead_{uuid_mod.uuid4().hex[:12]}",
                    **lead_data,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.leads.insert_one(lead_doc)
                created_count += 1
                    
            except Exception as e:
                logger.error(f"Row {idx + 2} error: {e}")
                errors.append({"row": idx + 2, "error": str(e)})
                continue
        
        # Log activity
        activity = ActivityLog(
            user_id=current_user.user_id,
            action="historical_data_upload",
            resource_type="lead",
            details={
                "filename": file.filename,
                "date_range": f"{min_date} to {max_date}",
                "deleted": deleted_count,
                "created": created_count,
                "errors": len(errors)
            }
        )
        activity_doc = activity.model_dump()
        activity_doc["created_at"] = activity_doc["created_at"].isoformat()
        await db.activity_logs.insert_one(activity_doc)
        
        return {
            "success": True,
            "date_range": {"min": min_date, "max": max_date},
            "deleted": deleted_count,
            "created": created_count,
            "errors": errors[:10] if errors else [],
            "total_errors": len(errors),
            "message": f"Replaced {deleted_count} leads with {created_count} new leads for dates up to {max_date}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Historical upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.get("/data-stats")
async def get_data_stats(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Get data statistics for the data management tab"""
    db = await get_db(request)
    
    total_leads = await db.leads.count_documents({})
    
    # Get date range of existing data
    date_pipeline = [
        {"$match": {"enquiry_date": {"$ne": None}}},
        {"$group": {
            "_id": None,
            "min_date": {"$min": "$enquiry_date"},
            "max_date": {"$max": "$enquiry_date"}
        }}
    ]
    date_result = await db.leads.aggregate(date_pipeline).to_list(1)
    
    min_date = date_result[0]["min_date"] if date_result else None
    max_date = date_result[0]["max_date"] if date_result else None
    
    # Get leads by month (last 12 months)
    monthly_pipeline = [
        {"$match": {"enquiry_date": {"$ne": None}}},
        {"$addFields": {
            "month": {"$substr": ["$enquiry_date", 0, 7]}
        }},
        {"$group": {"_id": "$month", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 12}
    ]
    monthly_data = await db.leads.aggregate(monthly_pipeline).to_list(12)
    
    return {
        "total_leads": total_leads,
        "date_range": {
            "min": min_date,
            "max": max_date
        },
        "monthly_distribution": [
            {"month": m["_id"], "count": m["count"]}
            for m in monthly_data
        ]
    }
