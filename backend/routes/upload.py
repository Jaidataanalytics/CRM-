from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from datetime import datetime, timezone
import logging
import io
import uuid

from models.user import User, UserRole
from models.activity_log import ActivityLog
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["Upload"])


async def get_db(request: Request):
    return request.app.state.db


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
    # City
    "City": "city",
    "city": "city",
    # Employee fields
    "Employee Code": "employee_code",
    "employee code": "employee_code",
    "Employee Name": "employee_name",
    "employee name": "employee_name",
    "Employee": "employee_name",
    "employee": "employee_name",
    "Employee Status": "employee_status",
    "employee status": "employee_status",
    # Enquiry fields
    "Enquiry No": "enquiry_no",
    "enquiry no": "enquiry_no",
    "Enquiry Date": "enquiry_date",
    "enquiry date": "enquiry_date",
    "Inquiry Date": "enquiry_date",
    "inquiry date": "enquiry_date",
    # Customer fields
    "Customer Type": "customer_type",
    "customer type": "customer_type",
    "Corporate Name": "corporate_name",
    "corporate name": "corporate_name",
    "Name": "name",
    "name": "name",
    "Customer Name": "name",
    "customer name": "name",
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
    "Product": "product",
    "product": "product",
    "Remarks": "remarks",
    "remarks": "remarks",
    # Status fields
    "EnquiryStatus": "enquiry_status",
    "Enquiry Status": "enquiry_status",
    "enquiry status": "enquiry_status",
    "Lead Status": "lead_status",
    "lead status": "lead_status",
    "Status": "lead_status",
    "status": "lead_status",
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
    "Follow Up Date": "planned_followup_date",
    "follow up date": "planned_followup_date",
    "LastFollowupDate": "last_followup_date",
    "Last Followup Date": "last_followup_date",
    "last followup date": "last_followup_date",
    "Enquiry Closure Date": "enquiry_closure_date",
    "enquiry closure date": "enquiry_closure_date",
    "Closure Date": "enquiry_closure_date",
    "closure date": "enquiry_closure_date",
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
    # Priority
    "Priority": "priority",
    "priority": "priority",
    # Expected Value
    "Expected Value": "expected_value",
    "expected value": "expected_value",
    "Value": "expected_value",
    "value": "expected_value",
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
    import pandas as pd
    if val is None or pd.isna(val):
        return None
    if isinstance(val, float) and str(val) == 'nan':
        return None
    if isinstance(val, str):
        val = val.strip()
        if val == '' or val.lower() == 'nan':
            return None
    return val


def parse_date(val):
    """Parse date value to string format - handles multiple formats"""
    import pandas as pd
    
    if val is None or pd.isna(val):
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
        
        # Check if already in correct format
        if len(val) == 10 and val[4] == '-' and val[7] == '-':
            return val
        
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
        
        # Fallback to pandas
        try:
            parsed = pd.to_datetime(val, dayfirst=True)
            if pd.notna(parsed):
                return parsed.strftime("%Y-%m-%d")
        except:
            pass
        
        return None
    
    return None


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
        
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        
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
                            cleaned = clean_value(val)
                            # Convert to string if not None
                            if cleaned is not None:
                                lead_data[db_field] = str(cleaned) if not isinstance(cleaned, str) else cleaned
                            else:
                                lead_data[db_field] = None
                
                enquiry_no = lead_data.get('enquiry_no')
                
                if enquiry_no:
                    # Check if lead exists
                    existing = await db.leads.find_one({"enquiry_no": str(enquiry_no)})
                    
                    if existing:
                        # Update existing lead
                        lead_data["updated_at"] = datetime.now(timezone.utc).isoformat()
                        await db.leads.update_one(
                            {"enquiry_no": str(enquiry_no)},
                            {"$set": lead_data}
                        )
                        updated_count += 1
                    else:
                        # Create new lead - directly without Pydantic
                        lead_doc = {
                            "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                            **lead_data,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.leads.insert_one(lead_doc)
                        created_count += 1
                else:
                    # Create new lead without enquiry_no - directly without Pydantic
                    lead_doc = {
                        "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
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
            "errors": errors[:10] if errors else [],
            "total_errors": len(errors),
            "message": f"Successfully processed: {created_count} created, {updated_count} updated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.get("/template")
async def get_upload_template(
    current_user: User = Depends(get_current_user)
):
    """Get the column template for upload"""
    return {
        "columns": ["Zone", "State", "Area Office", "Dealer", "Branch", "Location", 
                   "Employee Code", "Employee Name", "Employee Status", "Enquiry No",
                   "Enquiry Date", "Customer Type", "Corporate Name", "Name", 
                   "Phone Number", "Email", "PinCode", "Tehsil", "District",
                   "KVA", "Phase", "Qty", "Remarks", "Enquiry Status", "Enquiry Type",
                   "Enquiry Stage", "EO/PO Date", "Planned Followup Date", "Source",
                   "Source From", "Events", "No of Follow-ups", "Segment", "SubSegment",
                   "DG Ownership", "Created By", "PAN NO.", "Last Followup Date",
                   "Enquiry Closure Date", "Finance Required", "Finance Company", "Referred By"],
        "required_columns": ["Name", "State"],
        "date_columns": ["Enquiry Date", "EO/PO Date", "Planned Followup Date", 
                        "Last Followup Date", "Enquiry Closure Date"],
        "numeric_columns": ["KVA", "Qty", "No of Follow-ups"]
    }
