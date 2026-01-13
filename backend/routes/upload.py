from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from datetime import datetime, timezone
import logging
import io
import uuid

from models.user import User, UserRole
from models.activity_log import ActivityLog
from routes.auth import get_current_user
from utils.fuzzy_matcher import fuzzy_matcher, normalize_lead_data

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
    
    # Generate upload batch ID for tracking
    upload_batch_id = f"upload_{uuid.uuid4().hex[:8]}"
    
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
                        elif db_field in ['kva', 'expected_value']:
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
                phone_number = lead_data.get('phone_number')
                
                # ============================================
                # FUZZY MATCHING: Normalize field values
                # ============================================
                # Get existing unique values from database for fuzzy matching
                if not hasattr(upload_leads, '_existing_values'):
                    # Cache existing values for the upload session
                    existing_dealers = await db.leads.distinct("dealer")
                    existing_states = await db.leads.distinct("state")
                    existing_employees = await db.leads.distinct("employee_name")
                    existing_segments = await db.leads.distinct("segment")
                    upload_leads._existing_values = {
                        "dealer": [d for d in existing_dealers if d],
                        "state": [s for s in existing_states if s],
                        "employee_name": [e for e in existing_employees if e],
                        "segment": [s for s in existing_segments if s],
                        "enquiry_stage": fuzzy_matcher.STANDARD_STATUSES
                    }
                
                # Normalize the lead data using fuzzy matching
                lead_data = normalize_lead_data(lead_data, upload_leads._existing_values)
                
                # Build unique identifier query using enquiry_no + phone_number combination
                existing = None
                if enquiry_no and phone_number:
                    # Check by both enquiry_no AND phone_number
                    existing = await db.leads.find_one({
                        "enquiry_no": str(enquiry_no),
                        "phone_number": str(phone_number)
                    })
                elif enquiry_no:
                    # Fallback: check by enquiry_no only
                    existing = await db.leads.find_one({"enquiry_no": str(enquiry_no)})
                elif phone_number:
                    # Fallback: check by phone_number only
                    existing = await db.leads.find_one({"phone_number": str(phone_number)})
                
                # Check if this is a lost/closure update that needs questions
                # Won stages: Closed-Won, Order Booked
                # Faulty stage: Closed-Faulty (no closure questions)
                # Lost = any "closed" stage that is NOT won or faulty
                is_lost_closure = False
                enquiry_stage = lead_data.get('enquiry_stage', '')
                
                # Normalize enquiry_stage using fuzzy matching
                if enquiry_stage:
                    enquiry_stage = fuzzy_matcher.normalize_status(enquiry_stage)
                    lead_data['enquiry_stage'] = enquiry_stage
                
                stage_lower = enquiry_stage.lower() if enquiry_stage else ''
                
                won_stages = ['closed-won', 'order booked']
                faulty_stages = ['closed-faulty']
                
                is_closed = stage_lower.startswith('closed') or stage_lower == 'lost'
                is_won = stage_lower in won_stages
                is_faulty = stage_lower in faulty_stages
                
                if is_closed and not is_won and not is_faulty:
                    is_lost_closure = True
                    # Mark that this lead needs closure questions answered
                    lead_data['needs_closure_questions'] = True
                    lead_data['closure_type'] = 'lost'
                
                if existing:
                    # Update existing lead
                    lead_data["updated_at"] = datetime.now(timezone.utc).isoformat()
                    
                    # Check if this update is changing status to Lost (was not lost before)
                    old_stage = existing.get('enquiry_stage', '')
                    old_stage_lower = old_stage.lower() if old_stage else ''
                    was_closed = old_stage_lower.startswith('closed') or old_stage_lower == 'lost'
                    was_won = old_stage_lower in won_stages
                    was_faulty = old_stage_lower in faulty_stages
                    was_lost = was_closed and not was_won and not was_faulty
                    
                    if is_lost_closure and not was_lost:
                        lead_data['needs_closure_questions'] = True
                        lead_data['closure_type'] = 'lost'
                    
                    await db.leads.update_one(
                        {"lead_id": existing["lead_id"]},
                        {"$set": lead_data}
                    )
                    updated_count += 1
                else:
                    # Create new lead
                    uploader_name = current_user.name or current_user.email or "Unknown User"
                    lead_doc = {
                        "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                        **lead_data,
                        "added_by": uploader_name,
                        "upload_batch_id": upload_batch_id,  # Track which upload this came from
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
                "upload_batch_id": upload_batch_id,
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


# Column mapping for Lost Leads upload
LOST_LEADS_COLUMN_MAPPING = {
    # Standard fields
    "Zone": "zone",
    "zone": "zone",
    "State": "state",
    "state": "state",
    "Area": "area",
    "area": "area",
    "Office": "office",
    "office": "office",
    "Area Office": "area",
    "Dealer": "dealer",
    "dealer": "dealer",
    "Dealer Branch": "dealer",  # From demmoooo.xlsx
    "dealer branch": "dealer",
    "Branch": "branch",
    "branch": "branch",
    "Location": "location",
    "location": "location",
    "Employee Code": "employee_code",
    "employee code": "employee_code",
    "Employee Name": "employee_name",
    "employee name": "employee_name",
    "Employee": "employee_name",
    "Sales Executive": "employee_name",  # From demmoooo.xlsx
    "sales executive": "employee_name",
    "Enquiry No": "enquiry_no",
    "enquiry no": "enquiry_no",
    "Enquiry No.": "enquiry_no",  # With period - from demmoooo.xlsx
    "enquiry no.": "enquiry_no",
    "Enquiry Date": "enquiry_date",
    "enquiry date": "enquiry_date",
    "Customer Type": "customer_type",
    "customer type": "customer_type",
    "Corporate Name": "corporate_name",
    "corporate name": "corporate_name",
    "Name": "name",
    "name": "name",
    "Customer Name": "name",
    "Prospect Name": "name",  # Lost leads mapping
    "prospect name": "name",
    "PROSPECT NAME": "name",
    "Phone Number": "phone_number",
    "phone number": "phone_number",
    "Phone": "phone_number",
    "phone": "phone_number",
    "Mobile": "phone_number",
    "mobile": "phone_number",
    "Phone / Mobile No": "phone_number",  # From demmoooo.xlsx
    "phone / mobile no": "phone_number",
    "Phone/Mobile No": "phone_number",
    "Phone/Mobile": "phone_number",
    "Mobile No": "phone_number",
    "mobile no": "phone_number",
    "Email Address": "email_address",
    "email address": "email_address",
    "Email": "email_address",
    "email": "email_address",
    "PinCode": "pincode",
    "pincode": "pincode",
    "District": "location",  # Map District to Location for lost leads
    "district": "location",
    "Tehsil": "location",  # From demmoooo.xlsx - map to location
    "tehsil": "location",
    "Address": "address",  # From demmoooo.xlsx
    "address": "address",
    "Location": "location",
    "location": "location",
    "KVA": "kva",
    "kva": "kva",
    "Model": "model",  # From demmoooo.xlsx
    "model": "model",
    "Type": "enquiry_type",  # From demmoooo.xlsx - Hot/Warm/Cold
    "type": "enquiry_type",
    "Phase": "phase",
    "phase": "phase",
    "Qty": "qty",
    "qty": "qty",
    "Remarks": "remarks",
    "remarks": "remarks",
    "Latest Follow-up Remark": "remarks",  # From demmoooo.xlsx
    "latest follow-up remark": "remarks",
    "No Of Follow ups Done": "no_of_followups",  # From demmoooo.xlsx
    "no of follow ups done": "no_of_followups",
    "Segment": "segment",
    "segment": "segment",
    "Sub Segment": "sub_segment",  # From demmoooo.xlsx (with space)
    "sub segment": "sub_segment",
    "SubSegment": "sub_segment",
    "Enquiry Source": "source",  # From demmoooo.xlsx
    "enquiry source": "source",
    "Source": "source",
    "source": "source",
    
    # Lost lead specific mappings
    "Win Reason": "competitor",  # Competitor who won the deal
    "win reason": "competitor",
    "Win reason": "competitor",
    "WIN REASON": "competitor",
    "Competitor": "competitor",
    "competitor": "competitor",
    
    "Win Remarks": "lost_reason",  # Reason for losing
    "win remarks": "lost_reason",
    "Win remarks": "lost_reason",
    "WIN REMARKS": "lost_reason",
    "Lost Reason": "lost_reason",
    "lost reason": "lost_reason",
    
    "Lost Remarks": "lost_remarks",  # Additional remarks about the loss
    "lost remarks": "lost_remarks",
    "Lost remarks": "lost_remarks",
    "LOST REMARKS": "lost_remarks",
    
    "Lost Date": "lost_date",
    "lost date": "lost_date",
    "Closure Date": "lost_date",
    "closure date": "lost_date",
    "Enquiry Closure Date": "lost_date",
}


@router.post("/lost-leads")
async def upload_lost_leads(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload lost leads from Excel file.
    
    Key behavior:
    1. If lead exists (by phone_number OR enquiry_no): UPDATE it to Lost status with lost data
    2. If lead is already Lost: Skip (no duplicate lost entries)
    3. If lead doesn't exist: Create new lead as Lost
    4. Auto-set status to 'Lost' (enquiry_stage = 'Closed-Lost', enquiry_status = 'Closed')
    5. Special column mappings:
       - 'Win Reason' -> competitor
       - 'Win Remarks' -> lost_reason
       - 'Lost Remarks' -> lost_remarks
    """
    db = await get_db(request)
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    # Generate upload batch ID for tracking
    upload_batch_id = f"lost_upload_{uuid.uuid4().hex[:8]}"
    
    try:
        import pandas as pd
        
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        
        created_count = 0
        updated_count = 0
        skipped_lost_count = 0
        skipped_won_count = 0
        errors = []
        skipped_details = []  # Track details of skipped leads
        updated_details = []  # Track details of updated leads
        
        for idx, row in df.iterrows():
            try:
                lead_data = {}
                
                # Map columns
                for excel_col, db_field in LOST_LEADS_COLUMN_MAPPING.items():
                    if excel_col in df.columns:
                        val = row[excel_col]
                        
                        # Handle date fields
                        if db_field in ['enquiry_date', 'lost_date']:
                            lead_data[db_field] = parse_date(val)
                        # Handle numeric fields
                        elif db_field in ['kva']:
                            cleaned = clean_value(val)
                            if cleaned is not None:
                                try:
                                    lead_data[db_field] = float(cleaned)
                                except (ValueError, TypeError):
                                    lead_data[db_field] = None
                            else:
                                lead_data[db_field] = None
                        elif db_field in ['qty']:
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
                            if cleaned is not None:
                                lead_data[db_field] = str(cleaned) if not isinstance(cleaned, str) else cleaned
                            else:
                                lead_data[db_field] = None
                
                phone_number = lead_data.get('phone_number')
                enquiry_no = lead_data.get('enquiry_no')
                
                # Normalize phone number for comparison
                def normalize_phone(phone):
                    if not phone:
                        return ""
                    phone_str = str(phone)
                    # Handle scientific notation (e.g., 9.87654E+09)
                    if 'e' in phone_str.lower() or 'E' in phone_str:
                        try:
                            phone_str = str(int(float(phone_str)))
                        except (ValueError, OverflowError):
                            pass
                    # Remove all non-digit characters
                    normalized = ''.join(c for c in phone_str if c.isdigit())
                    # Handle country code prefixes (India: 91)
                    if len(normalized) > 10 and normalized.startswith('91'):
                        normalized = normalized[2:]
                    # Return last 10 digits
                    return normalized[-10:] if len(normalized) >= 10 else normalized
                
                normalized_phone = normalize_phone(phone_number)
                
                # Skip if phone_number OR enquiry_no already exists
                # This is different from regular upload which uses AND logic
                existing = None
                
                if normalized_phone and len(normalized_phone) >= 10:
                    # Build a comprehensive query to find matches
                    # Also normalize all stored phone numbers for comparison
                    phone_query = {
                        "$or": [
                            {"phone_number": normalized_phone},
                            {"phone_number": str(phone_number) if phone_number else ""},
                        ]
                    }
                    
                    # Also check with regex for phones that might have prefixes
                    # Match any phone ending with the normalized 10 digits
                    phone_query["$or"].append({"phone_number": {"$regex": f"{normalized_phone}$"}})
                    
                    # For phones stored with country code
                    phone_query["$or"].append({"phone_number": f"91{normalized_phone}"})
                    phone_query["$or"].append({"phone_number": f"+91{normalized_phone}"})
                    
                    existing = await db.leads.find_one(phone_query)
                    
                    if existing:
                        logger.debug(f"Found duplicate by phone: {normalized_phone} matches {existing.get('phone_number')}")
                
                if not existing and enquiry_no:
                    enquiry_str = str(enquiry_no).strip()
                    if enquiry_str:
                        existing = await db.leads.find_one({
                            "$or": [
                                {"enquiry_no": enquiry_str},
                                {"enquiry_no": {"$regex": f"^{enquiry_str}$", "$options": "i"}}
                            ]
                        })
                        
                        if existing:
                            logger.debug(f"Found duplicate by enquiry_no: {enquiry_str}")
                
                # Set lost_date to today if not provided
                if not lead_data.get('lost_date'):
                    lead_data['lost_date'] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                
                # Define stage categories
                won_stages = ['closed-won', 'order booked']
                lost_stages = ['closed-lost', 'lost']
                
                if existing:
                    existing_stage = existing.get('enquiry_stage', '').lower()
                    lead_name = lead_data.get('name') or existing.get('name') or existing.get('corporate_name') or 'Unknown'
                    lead_phone = normalized_phone or phone_number
                    
                    # Skip if already Lost
                    if existing_stage in lost_stages:
                        skipped_lost_count += 1
                        if len(skipped_details) < 50:  # Limit to first 50 for response size
                            skipped_details.append({
                                "row": idx + 2,
                                "name": lead_name,
                                "phone": str(lead_phone),
                                "reason": "Already Lost",
                                "current_stage": existing.get('enquiry_stage', '')
                            })
                        continue
                    
                    # Skip if Won - leave Won leads as is
                    if existing_stage in won_stages:
                        skipped_won_count += 1
                        if len(skipped_details) < 50:
                            skipped_details.append({
                                "row": idx + 2,
                                "name": lead_name,
                                "phone": str(lead_phone),
                                "reason": "Won - Preserved",
                                "current_stage": existing.get('enquiry_stage', '')
                            })
                        continue
                    
                    # For all other stages (Prospecting, Closed-Dropped, Faulty, etc.)
                    # -> Update to Lost and add lost info (competitor, lost_reason, lost_remarks)
                    
                    # Build update data - only update lost-related fields, don't overwrite everything
                    update_data = {
                        'enquiry_stage': 'Closed-Lost',
                        'enquiry_status': 'Closed',
                        'closure_type': 'lost',
                        'lost_date': lead_data.get('lost_date'),
                        'updated_at': datetime.now(timezone.utc).isoformat(),
                        'lost_upload_batch_id': upload_batch_id
                    }
                    
                    # Add lost-specific fields if provided in file
                    if lead_data.get('competitor'):
                        update_data['competitor'] = lead_data['competitor']
                    if lead_data.get('lost_reason'):
                        update_data['lost_reason'] = lead_data['lost_reason']
                    if lead_data.get('lost_remarks'):
                        update_data['lost_remarks'] = lead_data['lost_remarks']
                    
                    # If we have any of competitor/lost_reason/lost_remarks, no closure questions needed
                    if update_data.get('competitor') or update_data.get('lost_reason') or update_data.get('lost_remarks'):
                        update_data['needs_closure_questions'] = False
                    else:
                        # No lost info provided - may need closure questions
                        update_data['needs_closure_questions'] = True
                    
                    await db.leads.update_one(
                        {"lead_id": existing["lead_id"]},
                        {"$set": update_data}
                    )
                    updated_count += 1
                    if len(updated_details) < 50:
                        updated_details.append({
                            "row": idx + 2,
                            "name": lead_name,
                            "phone": str(lead_phone),
                            "previous_stage": existing.get('enquiry_stage', ''),
                            "has_lost_info": bool(update_data.get('competitor') or update_data.get('lost_reason') or update_data.get('lost_remarks'))
                        })
                    logger.info(f"Updated lead {existing['lead_id']} from '{existing_stage}' to Lost status")
                else:
                    # Create new lead - set all lost status fields
                    lead_data['enquiry_stage'] = 'Closed-Lost'
                    lead_data['enquiry_status'] = 'Closed'
                    lead_data['closure_type'] = 'lost'
                    
                    # If we have any of competitor/lost_reason/lost_remarks, no closure questions needed
                    if lead_data.get('competitor') or lead_data.get('lost_reason') or lead_data.get('lost_remarks'):
                        lead_data['needs_closure_questions'] = False
                    else:
                        lead_data['needs_closure_questions'] = True
                    
                    # For new lost leads: use enquiry_date from file if present, otherwise use lost_date
                    if not lead_data.get('enquiry_date'):
                        lead_data['enquiry_date'] = lead_data.get('lost_date')
                    
                    uploader_name = current_user.name or current_user.email or "Unknown User"
                    lead_doc = {
                        "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                        **lead_data,
                        "added_by": f"Lost Lead Import - {uploader_name}",
                        "upload_batch_id": upload_batch_id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.leads.insert_one(lead_doc)
                    created_count += 1
                
            except Exception as e:
                logger.error(f"Lost lead row {idx + 2} error: {e}")
                errors.append({"row": idx + 2, "error": str(e)})
                continue
        
        total_skipped = skipped_lost_count + skipped_won_count
        
        # Log activity
        activity = ActivityLog(
            user_id=current_user.user_id,
            action="lost_leads_upload",
            resource_type="lead",
            details={
                "upload_batch_id": upload_batch_id,
                "filename": file.filename,
                "created": created_count,
                "updated": updated_count,
                "skipped_lost": skipped_lost_count,
                "skipped_won": skipped_won_count,
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
            "skipped_lost": skipped_lost_count,
            "skipped_won": skipped_won_count,
            "skipped_total": total_skipped,
            "skipped_details": skipped_details,
            "updated_details": updated_details,
            "errors": errors[:10] if errors else [],
            "total_errors": len(errors),
            "total_rows": len(df),
            "message": f"Lost leads processed: {created_count} new, {updated_count} updated to Lost, {skipped_lost_count} already Lost, {skipped_won_count} Won (preserved)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lost leads upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.get("/lost-leads/template")
async def get_lost_leads_template(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Download template for lost leads upload"""
    import pandas as pd
    
    template_data = {
        'Zone': ['East', 'West'],
        'State': ['Bihar', 'Maharashtra'],
        'Area Office': ['Patna', 'Mumbai'],
        'Dealer': ['Dealer Name', 'Another Dealer'],
        'Employee Name': ['John Doe', 'Jane Smith'],
        'Enquiry No': ['E2504XXX00001', 'E2504XXX00002'],
        'Enquiry Date': ['2025-04-01', '2025-04-02'],
        'Corporate Name': ['ABC Corp', 'XYZ Ltd'],
        'Name': ['Customer Name', 'Customer 2'],
        'Phone Number': ['9876543210', '9876543211'],
        'Email': ['email@example.com', 'email2@example.com'],
        'KVA': [100, 250],
        'Segment': ['Corporate', 'Retail'],
        'Win Reason': ['Competitor A', 'Price Lower'],
        'Win Remarks': ['Lost due to price', 'Competitor offered better terms'],
        'Lost Remarks': ['Follow up after 6 months', 'Customer preferred local vendor'],
        'Lost Date': ['2025-06-01', '2025-06-15']
    }
    
    df = pd.DataFrame(template_data)
    
    output = io.BytesIO()
    df.to_excel(output, index=False, sheet_name='Lost Leads Template')
    output.seek(0)
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=lost_leads_upload_template.xlsx"}
    )


# Sales Order column mapping
SALES_ORDER_COLUMN_MAPPING = {
    # Zone/Location
    "Zone": "zone",
    "State": "state",
    "Dealer": "dealer",
    "Branch": "branch",
    # Employee
    "Employee Code": "employee_code",
    "Employee Name": "employee_name",
    "Employee Status": "employee_status",
    # Sales Order fields
    "Sales Order Number": "sales_order_no",
    "Sales Order Date": "sales_order_date",
    "Sales Order Cancellation Date": "sales_order_cancellation_date",
    "Sales Order Status": "sales_order_status",
    "Sales Order Ageing": "sales_order_ageing",
    # Product
    "Model": "model",
    "KVA": "kva",
    "Phase": "phase",
    "Qty": "qty",
    "Model Description": "model_description",
    # Customer
    "Customer Code": "customer_code",
    "Customer Name": "name",
    "Phone/Mobile Number": "phone_number",
    "Customer Address": "address",
    "Tehsil": "tehsil",
    "District": "district",
    "Pincode": "pincode",
    # PO fields
    "PO Number": "po_number",
    "PO Date": "po_date",
    "Installation in Scope": "installation_in_scope",
    # Enquiry reference
    "Enquiry no": "enquiry_no",
    "Enquiry Date": "enquiry_date",
    # Quotation
    "Quotation reference No": "quotation_no",
    "Quotation Date": "quotation_date",
    "Quotation Amount": "quotation_amount",
    # Allocation/Dispatch
    "Stock Allocation Status": "stock_allocation_status",
    "Promise Delivery Date": "promise_delivery_date",
    "Invoice No": "invoice_no",
    "Invoice Date": "invoice_date",
    "Ageing": "ageing",
    "OEM Order Date": "oem_order_date",
    "DispatchDate": "dispatch_date",
}


@router.post("/sales-order")
async def upload_sales_order(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload Sales Order data from Excel file.
    
    Key behavior:
    1. Ignore rows with Stock Allocation Status = "Unallotted"
    2. Match by Enquiry No first, then by Phone Number
    3. Group by Sales Order Number + Phone to calculate qty
    4. Multiple entries = multiple qty (gensets)
    5. Mark matched leads as "Closed-Won"
    6. Auto-mark dispatched if has DispatchDate or status indicates shipped
    """
    db = await get_db(request)
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    upload_batch_id = f"so_upload_{uuid.uuid4().hex[:8]}"
    
    try:
        import pandas as pd
        from utils.duplicate_detector import duplicate_detector, calculate_qualified_status
        
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        
        # Filter out Unallotted rows
        if 'Stock Allocation Status' in df.columns:
            original_count = len(df)
            df = df[df['Stock Allocation Status'].str.lower() != 'unallotted']
            filtered_count = original_count - len(df)
            logger.info(f"Filtered out {filtered_count} unallotted rows")
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        processed_details = []
        
        # Group by Sales Order Number + Phone to calculate qty
        # First, normalize phone numbers
        df['_normalized_phone'] = df.apply(
            lambda row: duplicate_detector.normalize_phone(
                row.get('Phone/Mobile Number') or row.get('phone_number')
            ), axis=1
        )
        
        # Group by SO Number + Phone
        so_groups = df.groupby(['Sales Order Number', '_normalized_phone'])
        
        now = datetime.now(timezone.utc).isoformat()
        
        for (so_no, phone), group in so_groups:
            try:
                # Check for valid SO Number and Phone
                if pd.isna(so_no) or str(so_no).strip() == '' or pd.isna(phone) or str(phone).strip() == '':
                    errors.append({"so_no": str(so_no), "error": "Missing SO Number or Phone"})
                    continue
                
                so_no = str(so_no).strip()
                phone = str(phone).strip()
                
                # Calculate qty: MAX(row_count, sum of Qty column)
                row_count = len(group)
                qty_sum = group['Qty'].sum() if 'Qty' in group.columns else row_count
                final_qty = max(row_count, int(qty_sum) if pd.notna(qty_sum) else row_count)
                
                # Collect engine numbers (Invoice No can serve as unique identifier)
                engine_numbers = []
                if 'Invoice No' in group.columns:
                    invoices = group['Invoice No'].dropna()
                    if len(invoices) > 0:
                        engine_numbers = [str(inv) for inv in invoices.unique() if pd.notna(inv) and str(inv).strip()]
                
                # Get first row for other data (they should be same for same SO+Phone)
                first_row = group.iloc[0]
                
                # Map columns to lead data
                lead_data = {}
                for excel_col, db_field in SALES_ORDER_COLUMN_MAPPING.items():
                    if excel_col in group.columns:
                        val = first_row.get(excel_col)
                        # Skip NaN values
                        if pd.isna(val):
                            continue
                        if db_field in ['sales_order_date', 'enquiry_date', 'po_date', 
                                       'quotation_date', 'invoice_date', 'promise_delivery_date',
                                       'oem_order_date', 'dispatch_date', 'sales_order_cancellation_date']:
                            lead_data[db_field] = parse_date(val)
                        elif db_field in ['kva', 'quotation_amount']:
                            if pd.notna(val):
                                try:
                                    lead_data[db_field] = float(val)
                                except (ValueError, TypeError):
                                    lead_data[db_field] = None
                        else:
                            lead_data[db_field] = clean_value(val)
                
                # Set won qty and engine numbers
                lead_data['won_qty'] = int(final_qty)  # Convert numpy int to Python int
                if engine_numbers:
                    lead_data['engine_numbers'] = engine_numbers
                
                # Set enquiry stage to Closed-Won
                lead_data['enquiry_stage'] = 'Closed-Won'
                lead_data['enquiry_status'] = 'Closed'
                lead_data['closure_type'] = 'won'
                
                # Check dispatch status
                so_status = str(first_row.get('Sales Order Status', '')).lower()
                dispatch_date = parse_date(first_row.get('DispatchDate'))
                
                if dispatch_date or 'ship' in so_status or 'invoice' in so_status:
                    lead_data['dispatch_status'] = 'dispatched'
                    if dispatch_date:
                        lead_data['dispatch_date'] = dispatch_date
                else:
                    lead_data['dispatch_status'] = 'pending'
                
                # Won date = Invoice Date
                if lead_data.get('invoice_date'):
                    lead_data['enquiry_closure_date'] = lead_data['invoice_date']
                
                # Try to match existing lead
                enquiry_no = lead_data.get('enquiry_no')
                existing = None
                match_type = None
                
                # First try by Enquiry No
                if enquiry_no:
                    existing = await db.leads.find_one({
                        "enquiry_no": enquiry_no.strip(),
                        "deleted_at": {"$exists": False}
                    }, {"_id": 0})
                    if existing:
                        match_type = "enquiry_no"
                
                # Then try by Phone
                if not existing and phone:
                    existing = await db.leads.find_one({
                        "$and": [
                            {"$or": [
                                {"phone_number": phone},
                                {"phone_number": {"$regex": f"{phone}$"}}
                            ]},
                            {"deleted_at": {"$exists": False}},
                            {"$or": [
                                {"is_duplicate": {"$exists": False}},
                                {"is_duplicate": False}
                            ]}
                        ]
                    }, {"_id": 0})
                    if existing:
                        match_type = "phone"
                
                if existing:
                    # Merge data into existing lead
                    merge_updates = duplicate_detector.merge_leads(existing, lead_data)
                    
                    # Always update these fields for SO
                    merge_updates['enquiry_stage'] = 'Closed-Won'
                    merge_updates['enquiry_status'] = 'Closed'
                    merge_updates['closure_type'] = 'won'
                    merge_updates['won_qty'] = int(final_qty)  # Convert numpy int
                    merge_updates['sales_order_no'] = str(so_no)
                    merge_updates['so_upload_batch_id'] = upload_batch_id
                    merge_updates['updated_at'] = now
                    
                    if dispatch_date or 'ship' in so_status or 'invoice' in so_status:
                        merge_updates['dispatch_status'] = 'dispatched'
                        if dispatch_date:
                            merge_updates['dispatch_date'] = dispatch_date
                    
                    if engine_numbers:
                        existing_engines = existing.get('engine_numbers', [])
                        combined_engines = list(set(existing_engines + engine_numbers))
                        merge_updates['engine_numbers'] = combined_engines
                    
                    # Calculate qualified status
                    merged_lead = {**existing, **merge_updates}
                    merge_updates['is_qualified'] = calculate_qualified_status(merged_lead)
                    
                    await db.leads.update_one(
                        {"lead_id": existing["lead_id"]},
                        {"$set": merge_updates}
                    )
                    updated_count += 1
                    
                    if len(processed_details) < 50:
                        processed_details.append({
                            "so_no": so_no,
                            "name": lead_data.get('name') or existing.get('name'),
                            "phone": phone,
                            "qty": final_qty,
                            "action": "updated",
                            "match_type": match_type,
                            "dispatch_status": merge_updates.get('dispatch_status', 'pending')
                        })
                else:
                    # Create new lead
                    uploader_name = current_user.name or current_user.email or "Unknown User"
                    
                    # Ensure phone is stored
                    lead_data['phone_number'] = phone
                    
                    # Calculate qualified status
                    lead_data['is_qualified'] = calculate_qualified_status(lead_data)
                    
                    lead_doc = {
                        "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                        **lead_data,
                        "added_by": f"Sales Order Import - {uploader_name}",
                        "upload_batch_id": upload_batch_id,
                        "so_upload_batch_id": upload_batch_id,
                        "created_at": now,
                        "updated_at": now
                    }
                    
                    await db.leads.insert_one(lead_doc)
                    created_count += 1
                    
                    if len(processed_details) < 50:
                        processed_details.append({
                            "so_no": so_no,
                            "name": lead_data.get('name'),
                            "phone": phone,
                            "qty": final_qty,
                            "action": "created",
                            "dispatch_status": lead_data.get('dispatch_status', 'pending')
                        })
                    
            except Exception as e:
                logger.error(f"SO row error for {so_no}: {e}")
                errors.append({"so_no": str(so_no), "error": str(e)})
                continue
        
        # Log activity
        activity = ActivityLog(
            user_id=current_user.user_id,
            action="sales_order_upload",
            resource_type="lead",
            details={
                "upload_batch_id": upload_batch_id,
                "filename": file.filename,
                "created": created_count,
                "updated": updated_count,
                "errors": len(errors)
            }
        )
        activity_doc = activity.model_dump()
        activity_doc["created_at"] = activity_doc["created_at"].isoformat()
        await db.activity_logs.insert_one(activity_doc)
        
        total_qty = sum(d.get('qty', 0) for d in processed_details)
        
        return {
            "success": True,
            "created": created_count,
            "updated": updated_count,
            "total_qty": total_qty,
            "processed_details": processed_details,
            "errors": errors[:10] if errors else [],
            "total_errors": len(errors),
            "message": f"Sales Orders processed: {created_count} new leads, {updated_count} updated to Won, Total Qty: {total_qty}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sales order upload error: {e}")
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
