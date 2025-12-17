from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from datetime import datetime, timezone
import logging
import io
import uuid

from models.user import User, UserRole
from models.lead import Lead
from models.activity_log import ActivityLog
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["Upload"])


async def get_db(request: Request):
    return request.app.state.db


# Column mapping from Excel to database fields
COLUMN_MAPPING = {
    "Zone": "zone",
    "State": "state",
    "Area": "area",
    "Office": "office",
    "Dealer": "dealer",
    "Branch": "branch",
    "Location": "location",
    "Employee Code": "employee_code",
    "Employee Name": "employee_name",
    "Employee Status": "employee_status",
    "Enquiry No": "enquiry_no",
    "Enquiry Date": "enquiry_date",
    "Customer Type": "customer_type",
    "Corporate Name": "corporate_name",
    "Name": "name",
    "Phone Number": "phone_number",
    "Email Address": "email_address",
    "PinCode": "pincode",
    "Tehsil": "tehsil",
    "District": "district",
    "KVA": "kva",
    "Phase": "phase",
    "Qty": "qty",
    "Remarks": "remarks",
    "EnquiryStatus": "enquiry_status",
    "EnquiryType": "enquiry_type",
    "Enquiry Stage": "enquiry_stage",
    "EO/PO Date": "eo_po_date",
    "Planned Followup Date": "planned_followup_date",
    "Source": "source",
    "Source From": "source_from",
    "Events": "events",
    "No of Follow-ups": "no_of_followups",
    "Segment": "segment",
    "SubSegment": "sub_segment",
    "DG Ownership": "dg_ownership",
    "Created By": "created_by",
    "PAN NO.": "pan_no",
    "LastFollowupDate": "last_followup_date",
    "Enquiry Closure Date": "enquiry_closure_date",
    "Finance Required": "finance_required",
    "Finance Company": "finance_company",
    "Referred By": "referred_by"
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
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        # Try various formats
        for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return val
    return str(val)


@router.post("/leads")
async def upload_leads(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload leads from Excel file"""
    db = await get_db(request)
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        import pandas as pd
        
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content))
        
        created_count = 0
        updated_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                lead_data = {}
                
                for excel_col, db_field in COLUMN_MAPPING.items():
                    if excel_col in df.columns:
                        val = row[excel_col]
                        
                        # Handle date fields
                        if db_field in ['enquiry_date', 'eo_po_date', 'planned_followup_date', 
                                       'last_followup_date', 'enquiry_closure_date']:
                            lead_data[db_field] = parse_date(val)
                        # Handle numeric fields
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
                            lead_data[db_field] = clean_value(val)
                
                enquiry_no = lead_data.get('enquiry_no')
                
                if enquiry_no:
                    # Check if lead exists
                    existing = await db.leads.find_one({"enquiry_no": enquiry_no})
                    
                    if existing:
                        # Update existing lead
                        lead_data["updated_at"] = datetime.now(timezone.utc).isoformat()
                        await db.leads.update_one(
                            {"enquiry_no": enquiry_no},
                            {"$set": lead_data}
                        )
                        updated_count += 1
                    else:
                        # Create new lead
                        lead = Lead(**lead_data)
                        lead_doc = lead.model_dump()
                        lead_doc["created_at"] = lead_doc["created_at"].isoformat()
                        lead_doc["updated_at"] = lead_doc["updated_at"].isoformat()
                        await db.leads.insert_one(lead_doc)
                        created_count += 1
                else:
                    # Create new lead without enquiry_no
                    lead = Lead(**lead_data)
                    lead_doc = lead.model_dump()
                    lead_doc["created_at"] = lead_doc["created_at"].isoformat()
                    lead_doc["updated_at"] = lead_doc["updated_at"].isoformat()
                    await db.leads.insert_one(lead_doc)
                    created_count += 1
                    
            except Exception as e:
                errors.append({"row": idx + 2, "error": str(e)})
                continue
        
        # Log activity
        activity = ActivityLog(
            user_id=current_user.user_id,
            action="bulk_upload",
            resource_type="lead",
            details={
                "filename": file.filename,
                "created": created_count,
                "updated": updated_count,
                "errors": len(errors)
            }
        )
        activity_doc = activity.model_dump()
        activity_doc["created_at"] = activity_doc["created_at"].isoformat()
        await db.activity_logs.insert_one(activity_doc)
        
        return {
            "success": True,
            "created": created_count,
            "updated": updated_count,
            "errors": errors[:10] if errors else [],  # Return first 10 errors
            "total_errors": len(errors)
        }
        
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.get("/template")
async def get_upload_template(
    current_user: User = Depends(get_current_user)
):
    """Get the column template for upload"""
    return {
        "columns": list(COLUMN_MAPPING.keys()),
        "required_columns": ["Enquiry No", "State", "Dealer", "Employee Name"],
        "date_columns": ["Enquiry Date", "EO/PO Date", "Planned Followup Date", 
                        "LastFollowupDate", "Enquiry Closure Date"],
        "numeric_columns": ["KVA", "Qty", "No of Follow-ups"]
    }
