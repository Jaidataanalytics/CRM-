"""
Upload Routes V2 - Complete rewrite with correct business logic

Upload Types:
1. LEAD Upload - New enquiries
2. LOST Upload - Mark leads as lost
3. SO Upload - Sales orders (mark as won)
4. REMARK Upload - Update follow-up info

Logic Summary:
- Match by Enquiry Number first
- Then match by Phone + KVA check
- CLOSED leads = repeat customers (create new)
- OPEN leads with same KVA = duplicates (merge)
"""

from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from datetime import datetime, timezone
import logging
import io
import uuid
import pandas as pd
import numpy as np

from models.user import User, UserRole
from models.activity_log import ActivityLog
from routes.auth import get_current_user
from utils.fuzzy_matcher import fuzzy_matcher, normalize_lead_data
from utils.duplicate_detector import duplicate_detector, calculate_qualified_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["Upload"])


async def get_db(request: Request):
    return request.app.state.db


# ============================================
# CLOSED STAGES - All variations
# ============================================
CLOSED_STAGES = [
    "closed-won", "order booked",
    "closed-lost", "lost",
    "closed-dropped", "closed-not interested",
    "closed-budget issue", "closed-competitor",
    "closed-faulty"
]


def is_lead_closed(stage: str) -> bool:
    """Check if a lead stage is considered CLOSED"""
    if not stage:
        return False
    stage_lower = stage.lower().strip()
    return stage_lower in CLOSED_STAGES or stage_lower.startswith('closed')


def is_lead_won(stage: str) -> bool:
    """Check if lead is specifically WON"""
    if not stage:
        return False
    stage_lower = stage.lower().strip()
    return stage_lower in ['closed-won', 'order booked']


def is_lead_lost(stage: str) -> bool:
    """Check if lead is specifically LOST"""
    if not stage:
        return False
    stage_lower = stage.lower().strip()
    return stage_lower in ['closed-lost', 'lost']


# ============================================
# COLUMN MAPPINGS FOR ALL TEMPLATE TYPES
# ============================================

LEAD_UPLOAD_MAPPING = {
    # Zone/Region
    "Zone": "zone", "zone": "zone",
    "State": "state", "state": "state",
    "Area Office": "area", "Area": "area", "area": "area", "area office": "area",
    "Office": "office", "office": "office",
    # Dealer/Branch
    "Dealer": "dealer", "dealer": "dealer",
    "Branch": "branch", "branch": "branch",
    "Branch Location": "branch", "branch location": "branch",
    "Location": "location", "location": "location",
    # Employee
    "Employee Code": "employee_code", "employee code": "employee_code",
    "Employee Name": "employee_name", "employee name": "employee_name",
    "Employee Status": "employee_status", "employee status": "employee_status",
    # Enquiry
    "Enquiry No": "enquiry_no", "enquiry no": "enquiry_no",
    "Enquiry No s.o.": "enquiry_no", "enquiry no s.o.": "enquiry_no",
    "Enquiry Date": "enquiry_date", "enquiry date": "enquiry_date",
    # Customer
    "Customer Type": "customer_type", "customer type": "customer_type",
    "Corporate Name": "corporate_name", "corporate name": "corporate_name",
    "Name": "name", "name": "name",
    "Phone Number": "phone_number", "phone number": "phone_number",
    "Phone": "phone_number", "phone": "phone_number",
    "Mobile": "phone_number", "mobile": "phone_number",
    "Email Address": "email_address", "email address": "email_address",
    "Email": "email_address", "email": "email_address",
    "Address": "address", "address": "address",
    "PinCode": "pincode", "pincode": "pincode", "Pin Code": "pincode",
    "Tehsil": "tehsil", "tehsil": "tehsil",
    "District": "district", "district": "district",
    # Product
    "KVA": "kva", "kva": "kva",
    "Phase": "phase", "phase": "phase",
    "Qty": "qty", "qty": "qty", "Quantity": "qty",
    "Model": "model", "model": "model",
    "Remarks": "remarks", "remarks": "remarks",
    # Status
    "EnquiryStatus": "enquiry_status", "Enquiry Status": "enquiry_status", "enquiry status": "enquiry_status",
    "EnquiryType": "enquiry_type", "Enquiry Type": "enquiry_type", "enquiry type": "enquiry_type",
    "Enquiry Stage": "enquiry_stage", "enquiry stage": "enquiry_stage",
    # Dates
    "EO/PO Date": "eo_po_date", "eo/po date": "eo_po_date",
    "Planned Followup Date": "planned_followup_date", "planned followup date": "planned_followup_date",
    "LastFollowupDate": "last_followup_date", "Last Followup Date": "last_followup_date",
    "Enquiry Closure Date": "enquiry_closure_date", "enquiry closure date": "enquiry_closure_date",
    # Source
    "Source": "source", "source": "source",
    "Source From": "source_from", "source from": "source_from",
    "Events": "events", "events": "events",
    "No of Follow-ups": "no_of_followups", "no of follow-ups": "no_of_followups",
    # Segment
    "Segment": "segment", "segment": "segment",
    "SubSegment": "sub_segment", "Sub Segment": "sub_segment", "sub segment": "sub_segment",
    "DG Ownership": "dg_ownership", "dg ownership": "dg_ownership",
    # Other
    "Created By": "created_by", "created by": "created_by",
    "PAN NO.": "pan_no", "pan no.": "pan_no", "PAN": "pan_no",
    "Finance Required": "finance_required", "finance required": "finance_required",
    "Finance Company": "finance_company", "finance company": "finance_company",
    "Referred By": "referred_by", "referred by": "referred_by",
}

LOST_UPLOAD_MAPPING = {
    # Dealer/Branch
    "Dealer": "dealer", "dealer": "dealer",
    "Branch": "branch", "branch": "branch",
    # Employee
    "Employee Code": "employee_code", "employee code": "employee_code",
    "Sales Executive": "employee_name", "sales executive": "employee_name",
    "Employee Name": "employee_name", "employee name": "employee_name",
    # Enquiry
    "Enquiry No.": "enquiry_no", "enquiry no.": "enquiry_no",
    "Enquiry No": "enquiry_no", "enquiry no": "enquiry_no",
    "Enquiry Date": "enquiry_date", "enquiry date": "enquiry_date",
    "Enquiry Source": "source", "enquiry source": "source",
    # Segment
    "Segment": "segment", "segment": "segment",
    "Sub Segment": "sub_segment", "sub segment": "sub_segment",
    # Type & Date
    "Type": "contact_type", "type": "contact_type",
    "Lost Date": "lost_date", "lost date": "lost_date",
    # Product
    "Model": "model", "model": "model",
    "Phase": "phase", "phase": "phase",
    "KVA": "kva", "kva": "kva",
    # Customer
    "Prospect Name": "name", "prospect name": "name",
    "Name": "name", "name": "name",
    "Phone / Mobile No": "phone_number", "phone / mobile no": "phone_number",
    "Phone Number": "phone_number", "phone number": "phone_number",
    "Phone": "phone_number", "phone": "phone_number",
    "Mobile": "phone_number", "mobile": "phone_number",
    "Address": "address", "address": "address",
    "Tehsil": "tehsil", "tehsil": "tehsil",
    "District": "district", "district": "district",
    # Lost-specific fields (IMPORTANT MAPPING!)
    "Win Reason": "competitor", "win reason": "competitor",  # Who won the deal
    "Win Remarks": "lost_reason", "win remarks": "lost_reason",  # Why we lost
    "Latest Follow-up Remark": "remarks", "latest follow-up remark": "remarks",
    "Lost Remarks": "lost_remarks", "lost remarks": "lost_remarks",
    "No Of Follow ups Done": "no_of_followups", "no of follow ups done": "no_of_followups",
}

SO_UPLOAD_MAPPING = {
    # Zone/Region
    "Zone": "zone", "zone": "zone",
    "State": "state", "state": "state",
    # Dealer/Branch
    "Dealer": "dealer", "dealer": "dealer",
    "Branch": "branch", "branch": "branch",
    # Employee
    "Employee Code": "employee_code", "employee code": "employee_code",
    "Employee Name": "employee_name", "employee name": "employee_name",
    "Employee Status": "employee_status", "employee status": "employee_status",
    # Sales Order
    "Sales Order Number": "sales_order_no", "sales order number": "sales_order_no",
    "Sales Order Date": "sales_order_date", "sales order date": "sales_order_date",
    "Sales Order Cancellation Date": "sales_order_cancellation_date",
    "Sales Order Status": "sales_order_status", "sales order status": "sales_order_status",
    "Sales Order Ageing": "sales_order_ageing", "sales order ageing": "sales_order_ageing",
    # Product
    "Model": "model", "model": "model",
    "KVA": "kva", "kva": "kva",
    "Phase": "phase", "phase": "phase",
    "Qty": "qty", "qty": "qty",
    "Model Description": "model_description", "model description": "model_description",
    # Customer
    "Customer Code": "customer_code", "customer code": "customer_code",
    "Customer Name": "name", "customer name": "name",
    "Phone/Mobile Number": "phone_number", "phone/mobile number": "phone_number",
    "Phone Number": "phone_number", "phone number": "phone_number",
    "Customer Address": "address", "customer address": "address",
    "Address": "address", "address": "address",
    "Tehsil": "tehsil", "tehsil": "tehsil",
    "District": "district", "district": "district",
    "Pincode": "pincode", "pincode": "pincode",
    # PO
    "PO Number": "po_number", "po number": "po_number",
    "PO Date": "po_date", "po date": "po_date",
    "Installation in Scope": "installation_in_scope", "installation in scope": "installation_in_scope",
    # Enquiry
    "Enquiry no": "enquiry_no", "enquiry no": "enquiry_no",
    "Enquiry No": "enquiry_no",
    "Enquiry Date": "enquiry_date", "enquiry date": "enquiry_date",
    # Quotation
    "Quotation reference No": "quotation_ref_no", "quotation reference no": "quotation_ref_no",
    "Quotation Date": "quotation_date", "quotation date": "quotation_date",
    "Quotation Amount": "quotation_amount", "quotation amount": "quotation_amount",
    # Stock/Delivery
    "Stock Allocation Status": "stock_allocation_status",
    "Promise Delivery Date": "promise_delivery_date", "promise delivery date": "promise_delivery_date",
    # Invoice
    "Invoice No": "invoice_no", "invoice no": "invoice_no",
    "Invoice Date": "invoice_date", "invoice date": "invoice_date",
    "Ageing": "ageing", "ageing": "ageing",
    # OEM/Dispatch
    "OEM Order Date": "oem_order_date", "oem order date": "oem_order_date",
    "DispatchDate": "dispatch_date", "dispatchdate": "dispatch_date",
    "Dispatch Date": "dispatch_date", "dispatch date": "dispatch_date",
}

REMARK_UPLOAD_MAPPING = {
    # Dealer/Branch
    "Dealer Branch": "dealer", "dealer branch": "dealer",
    "Dealer": "dealer", "dealer": "dealer",
    # Employee
    "Employee Code": "employee_code", "employee code": "employee_code",
    "Employee Name": "employee_name", "employee name": "employee_name",
    "Employee Status": "employee_status", "employee status": "employee_status",
    # Enquiry
    "Enquiry Number": "enquiry_no", "enquiry number": "enquiry_no",
    "Enquiry No": "enquiry_no", "enquiry no": "enquiry_no",
    "Enquiry Date": "enquiry_date", "enquiry date": "enquiry_date",
    # Customer
    "Customer Type": "customer_type", "customer type": "customer_type",
    "Name": "name", "name": "name",
    "Address": "address", "address": "address",
    "City": "city", "city": "city",
    "Tehsil": "tehsil", "tehsil": "tehsil",
    "District": "district", "district": "district",
    "Phone": "phone_number", "phone": "phone_number",
    "Mobile": "mobile_number", "mobile": "mobile_number",
    "Email": "email_address", "email": "email_address",
    # Product
    "Model": "model", "model": "model",
    "Phase": "phase", "phase": "phase",
    "KVA": "kva", "kva": "kva",
    "Quantity": "qty", "quantity": "qty",
    # Follow-up fields
    "Last Followup Date": "last_followup_date", "last followup date": "last_followup_date",
    "Last Follow-up Remark": "last_followup_remark", "last follow-up remark": "last_followup_remark",
    "Next Follow Up Date": "planned_followup_date", "next follow up date": "planned_followup_date",
    "Next Follow Up Remark": "next_followup_remark", "next follow up remark": "next_followup_remark",
    # Status
    "Enquiry Status": "enquiry_status", "enquiry status": "enquiry_status",
    "Enquiry Stage": "enquiry_stage", "enquiry stage": "enquiry_stage",
    "Enquiry Ageing Days": "enquiry_ageing_days", "enquiry ageing days": "enquiry_ageing_days",
    # Source
    "Enquiry Source": "source", "enquiry source": "source",
    "Referred By": "referred_by", "referred by": "referred_by",
    # Followup info
    "No Of Followup": "no_of_followups", "no of followup": "no_of_followups",
    "Type": "contact_type", "type": "contact_type",
    "Enquiry Not Followed From (No Of Days)": "days_not_followed",
    "FY": "financial_year", "fy": "financial_year",
}


# ============================================
# UTILITY FUNCTIONS
# ============================================

def clean_value(val):
    """Clean and convert value to native Python types"""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    if pd.isna(val):
        return None
    if isinstance(val, str):
        val = val.strip()
        if val == '' or val.lower() == 'nan' or val.lower() == 'none':
            return None
    # Convert numpy types to native Python types
    if isinstance(val, (np.integer, np.int64, np.int32)):
        return int(val)
    if isinstance(val, (np.floating, np.float64, np.float32)):
        if np.isnan(val):
            return None
        return float(val)
    if isinstance(val, np.bool_):
        return bool(val)
    if isinstance(val, pd.Timestamp):
        return val.strftime("%Y-%m-%d")
    return val


def normalize_phone(phone) -> str:
    """Normalize phone number - keep only last 10 digits"""
    if not phone:
        return ""
    phone_str = str(phone).strip()
    # Remove all non-digit characters
    normalized = ''.join(c for c in phone_str if c.isdigit())
    # Handle country code prefixes (India: 91)
    if len(normalized) > 10 and normalized.startswith('91'):
        normalized = normalized[2:]
    # Return last 10 digits
    return normalized[-10:] if len(normalized) >= 10 else normalized


def parse_date(date_val) -> str:
    """Parse date value to string format YYYY-MM-DD"""
    if not date_val:
        return None
    if pd.isna(date_val):
        return None
    if isinstance(date_val, pd.Timestamp):
        return date_val.strftime("%Y-%m-%d")
    if isinstance(date_val, datetime):
        return date_val.strftime("%Y-%m-%d")
    if isinstance(date_val, str):
        date_val = date_val.strip()
        if not date_val or date_val.lower() in ['nan', 'none', 'nat']:
            return None
        # Try various formats
        formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%Y", "%d %b %Y", "%Y/%m/%d"]
        for fmt in formats:
            try:
                return datetime.strptime(date_val.split()[0], fmt).strftime("%Y-%m-%d")
            except (ValueError, IndexError):
                continue
        return date_val  # Return as-is if can't parse
    return None


def compare_kva(kva1, kva2) -> bool:
    """Compare KVA values - exact match only, blank = different"""
    # If either is blank/None, they are DIFFERENT
    if kva1 is None or kva2 is None:
        return False
    if isinstance(kva1, str) and kva1.strip() == '':
        return False
    if isinstance(kva2, str) and kva2.strip() == '':
        return False
    
    # Convert to float for comparison
    try:
        kva1_float = float(kva1)
        kva2_float = float(kva2)
        return kva1_float == kva2_float
    except (ValueError, TypeError):
        # If can't convert, compare as strings
        return str(kva1).strip() == str(kva2).strip()


def map_row_to_lead(row: pd.Series, column_mapping: dict) -> dict:
    """Map a DataFrame row to lead data using column mapping"""
    lead_data = {}
    for col in row.index:
        col_stripped = str(col).strip()
        db_field = column_mapping.get(col_stripped) or column_mapping.get(col_stripped.lower())
        if db_field:
            value = clean_value(row[col])
            if value is not None:
                lead_data[db_field] = value
    return lead_data


def get_row_data_count(row_data: dict) -> int:
    """Count how many non-empty fields a row has"""
    count = 0
    for key, value in row_data.items():
        if value is not None and value != '' and not (isinstance(value, float) and np.isnan(value)):
            count += 1
    return count


def detect_template_type(columns: list) -> str:
    """Detect which template type based on column names"""
    columns_lower = [str(c).lower().strip() for c in columns]
    
    # SO Upload - has "sales order number"
    if any('sales order number' in c for c in columns_lower):
        return 'SO'
    
    # Lost Upload - has "win reason" or "win remarks" or "lost date"
    if any('win reason' in c or 'win remarks' in c or 'lost date' in c for c in columns_lower):
        return 'LOST'
    
    # Remark Upload - has "next follow up date" or "last follow-up remark"
    if any('next follow up date' in c or 'last follow-up remark' in c or 'next follow up remark' in c for c in columns_lower):
        return 'REMARK'
    
    # Default - Lead Upload
    return 'LEAD'


def merge_lead_data(existing: dict, incoming: dict) -> dict:
    """
    Merge incoming data into existing lead.
    - Incoming values overwrite existing (if not empty)
    - Empty values in incoming do NOT overwrite existing
    """
    updates = {}
    
    # Fields to skip (never overwrite)
    skip_fields = ['lead_id', '_id', 'created_at', 'is_duplicate', 'original_lead_id']
    
    for key, incoming_value in incoming.items():
        if key in skip_fields:
            continue
        
        # Skip empty incoming values
        if incoming_value is None:
            continue
        if isinstance(incoming_value, str) and incoming_value.strip() == '':
            continue
        if isinstance(incoming_value, float) and np.isnan(incoming_value):
            continue
        
        existing_value = existing.get(key)
        
        # Update if existing is empty OR incoming is different
        if existing_value is None or existing_value == '' or incoming_value != existing_value:
            updates[key] = incoming_value
    
    return updates


# ============================================
# TEMPLATE DETECTION ENDPOINT
# ============================================

@router.post("/detect-template")
async def detect_template(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Detect the template type from uploaded file"""
    try:
        content = await file.read()
        
        # Read Excel file
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content), nrows=0)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content), nrows=0)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use .xlsx, .xls, or .csv")
        
        columns = df.columns.tolist()
        template_type = detect_template_type(columns)
        
        # Get row count
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df_full = pd.read_excel(io.BytesIO(content))
        else:
            df_full = pd.read_csv(io.BytesIO(content))
        
        row_count = len(df_full)
        
        template_names = {
            'LEAD': 'Lead Upload',
            'LOST': 'Lost Leads Upload',
            'SO': 'Sales Order Upload',
            'REMARK': 'Remark Upload'
        }
        
        return {
            "success": True,
            "template_type": template_type,
            "template_name": template_names.get(template_type, 'Unknown'),
            "row_count": row_count,
            "columns": columns[:10],  # First 10 columns for preview
            "message": f"Detected as {template_names.get(template_type, 'Unknown')} with {row_count} rows"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to detect template: {str(e)}")


# ============================================
# UNIFIED UPLOAD ENDPOINT
# ============================================

@router.post("/process")
async def process_upload(
    request: Request,
    file: UploadFile = File(...),
    template_type: str = None,  # LEAD, LOST, SO, REMARK
    current_user: User = Depends(get_current_user)
):
    """
    Unified upload endpoint - processes file based on template type.
    If template_type not provided, auto-detects.
    """
    try:
        db = await get_db(request)
        content = await file.read()
        
        # Read Excel file
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use .xlsx, .xls, or .csv")
        
        # Auto-detect template if not provided
        if not template_type:
            template_type = detect_template_type(df.columns.tolist())
        
        template_type = template_type.upper()
        
        # Route to appropriate processor
        if template_type == 'LEAD':
            return await process_lead_upload(db, df, current_user, file.filename)
        elif template_type == 'LOST':
            return await process_lost_upload(db, df, current_user, file.filename)
        elif template_type == 'SO':
            return await process_so_upload(db, df, current_user, file.filename)
        elif template_type == 'REMARK':
            return await process_remark_upload(db, df, current_user, file.filename)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown template type: {template_type}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {str(e)}")


# ============================================
# LEAD UPLOAD PROCESSOR
# ============================================

async def process_lead_upload(db, df: pd.DataFrame, current_user: User, filename: str):
    """
    Process Lead Upload with logic:
    1. Match by Enquiry Number → Update different fields
    2. No match → Match by Phone
       - CLOSED → Create NEW lead
       - OPEN + KVA SAME → DUPLICATE (merge)
       - OPEN + KVA DIFFERENT → Create NEW lead
    3. No match at all → Create NEW lead
    """
    upload_batch_id = f"lead_upload_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    created_count = 0
    updated_count = 0
    duplicate_count = 0
    skipped_count = 0
    errors = []
    
    # Track processed enquiry numbers to handle duplicates in same file
    processed_enquiry_nos = {}  # enquiry_no -> {row_idx, data_count, row_data}
    
    for idx, row in df.iterrows():
        try:
            lead_data = map_row_to_lead(row, LEAD_UPLOAD_MAPPING)
            
            if not lead_data:
                continue
            
            enquiry_no = lead_data.get('enquiry_no')
            phone_number = lead_data.get('phone_number')
            kva = lead_data.get('kva')
            
            # Normalize phone
            normalized_phone = normalize_phone(phone_number)
            if normalized_phone:
                lead_data['phone_number'] = normalized_phone
            
            # Parse dates
            for date_field in ['enquiry_date', 'planned_followup_date', 'last_followup_date', 'enquiry_closure_date', 'eo_po_date']:
                if lead_data.get(date_field):
                    lead_data[date_field] = parse_date(lead_data[date_field])
            
            # Check for duplicates within same file
            if enquiry_no and enquiry_no in processed_enquiry_nos:
                prev = processed_enquiry_nos[enquiry_no]
                current_data_count = get_row_data_count(lead_data)
                # Keep the one with more data
                if current_data_count <= prev['data_count']:
                    skipped_count += 1
                    continue
                # Current has more data, will process this one instead
            
            # Track this row
            if enquiry_no:
                processed_enquiry_nos[enquiry_no] = {
                    'row_idx': idx,
                    'data_count': get_row_data_count(lead_data),
                    'row_data': lead_data
                }
            
            # STEP 1: Match by Enquiry Number
            existing = None
            match_type = None
            
            if enquiry_no:
                existing = await db.leads.find_one({
                    "enquiry_no": enquiry_no.strip(),
                    "deleted_at": {"$exists": False}
                }, {"_id": 0})
                if existing:
                    match_type = "enquiry_no"
            
            # STEP 2: If no enquiry match, try Phone
            if not existing and normalized_phone and len(normalized_phone) >= 10:
                # Find by phone
                phone_matches = await db.leads.find({
                    "$or": [
                        {"phone_number": normalized_phone},
                        {"phone_number": {"$regex": f"{normalized_phone}$"}}
                    ],
                    "deleted_at": {"$exists": False},
                    "$and": [
                        {"$or": [
                            {"is_duplicate": {"$exists": False}},
                            {"is_duplicate": False}
                        ]}
                    ]
                }, {"_id": 0}).to_list(10)
                
                if phone_matches:
                    # Check each match
                    for match in phone_matches:
                        existing_stage = match.get('enquiry_stage', '')
                        existing_kva = match.get('kva')
                        
                        if is_lead_closed(existing_stage):
                            # CLOSED lead - check if incoming has enquiry_no
                            if enquiry_no:
                                # Has enquiry_no - this is a repeat customer, create NEW lead
                                existing = None
                                match_type = None
                                break
                            else:
                                # No enquiry_no - check KVA
                                if compare_kva(existing_kva, kva):
                                    # Same KVA, no enquiry_no - SKIP as duplicate of closed lead
                                    existing = match
                                    match_type = "phone_closed_skip"
                                    break
                                else:
                                    # Different KVA - create NEW lead
                                    existing = None
                                    match_type = None
                                    break
                        else:
                            # OPEN lead - check KVA
                            if compare_kva(existing_kva, kva):
                                # Same KVA - DUPLICATE
                                existing = match
                                match_type = "phone_kva"
                                break
                            else:
                                # Different KVA - create NEW
                                existing = None
                                match_type = None
            
            # PROCESS based on match result
            if existing and match_type == "enquiry_no":
                # Enquiry number match - update different fields
                updates = merge_lead_data(existing, lead_data)
                if updates:
                    updates['updated_at'] = now
                    # Recalculate qualified status
                    merged = {**existing, **updates}
                    updates['is_qualified'] = calculate_qualified_status(merged)
                    
                    await db.leads.update_one(
                        {"lead_id": existing["lead_id"]},
                        {"$set": updates}
                    )
                    updated_count += 1
                else:
                    skipped_count += 1  # No changes needed
                    
            elif existing and match_type == "phone_kva":
                # Phone + KVA match (OPEN lead) - DUPLICATE, merge
                updates = merge_lead_data(existing, lead_data)
                updates['updated_at'] = now
                merged = {**existing, **updates}
                updates['is_qualified'] = calculate_qualified_status(merged)
                
                await db.leads.update_one(
                    {"lead_id": existing["lead_id"]},
                    {"$set": updates}
                )
                duplicate_count += 1
                
            else:
                # No match or CLOSED or different KVA - Create NEW lead
                uploader_name = current_user.name or current_user.email or "Unknown"
                
                lead_doc = {
                    "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                    **lead_data,
                    "is_qualified": calculate_qualified_status(lead_data),
                    "added_by": uploader_name,
                    "upload_batch_id": upload_batch_id,
                    "created_at": now,
                    "updated_at": now
                }
                
                await db.leads.insert_one(lead_doc)
                created_count += 1
                
        except Exception as e:
            logger.error(f"Lead upload row {idx + 2} error: {e}")
            errors.append({"row": idx + 2, "error": str(e)})
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="lead_upload",
        resource_type="lead",
        details={
            "upload_batch_id": upload_batch_id,
            "filename": filename,
            "created": created_count,
            "updated": updated_count,
            "duplicates_merged": duplicate_count,
            "skipped": skipped_count,
            "errors": len(errors)
        }
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {
        "success": True,
        "template_type": "LEAD",
        "created": created_count,
        "updated": updated_count,
        "duplicates_merged": duplicate_count,
        "skipped": skipped_count,
        "total_rows": len(df),
        "errors": errors[:10] if errors else [],
        "total_errors": len(errors),
        "message": f"Lead Upload: {created_count} created, {updated_count} updated, {duplicate_count} duplicates merged, {skipped_count} skipped"
    }


# ============================================
# LOST LEADS UPLOAD PROCESSOR
# ============================================

async def process_lost_upload(db, df: pd.DataFrame, current_user: User, filename: str):
    """
    Process Lost Upload with logic:
    1. Match by Enquiry Number:
       - OPEN → Change to Closed-Lost
       - WON → Do nothing
       - LOST → Leave as is
       - OTHER CLOSED → Update to Closed-Lost
    2. No match → Match by Phone:
       - CLOSED → Create NEW Closed-Lost lead
       - OPEN + KVA SAME → Merge & close BOTH as Lost
       - OPEN + KVA DIFFERENT → Create NEW Closed-Lost lead
    3. No match → Create NEW Closed-Lost lead
    """
    upload_batch_id = f"lost_upload_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    created_count = 0
    updated_count = 0
    skipped_won_count = 0
    skipped_already_lost_count = 0
    errors = []
    
    # Track processed enquiry numbers
    processed_enquiry_nos = {}
    
    for idx, row in df.iterrows():
        try:
            lead_data = map_row_to_lead(row, LOST_UPLOAD_MAPPING)
            
            if not lead_data:
                continue
            
            enquiry_no = lead_data.get('enquiry_no')
            phone_number = lead_data.get('phone_number')
            kva = lead_data.get('kva')
            
            # Normalize phone
            normalized_phone = normalize_phone(phone_number)
            if normalized_phone:
                lead_data['phone_number'] = normalized_phone
            
            # Parse dates
            if lead_data.get('lost_date'):
                lead_data['lost_date'] = parse_date(lead_data['lost_date'])
            if lead_data.get('enquiry_date'):
                lead_data['enquiry_date'] = parse_date(lead_data['enquiry_date'])
            
            # Set lost date to today if not provided
            if not lead_data.get('lost_date'):
                lead_data['lost_date'] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            
            # Check for duplicates in same file
            if enquiry_no and enquiry_no in processed_enquiry_nos:
                prev = processed_enquiry_nos[enquiry_no]
                current_data_count = get_row_data_count(lead_data)
                if current_data_count <= prev['data_count']:
                    continue
            
            if enquiry_no:
                processed_enquiry_nos[enquiry_no] = {
                    'row_idx': idx,
                    'data_count': get_row_data_count(lead_data)
                }
            
            # STEP 1: Match by Enquiry Number
            existing = None
            match_type = None
            
            if enquiry_no:
                existing = await db.leads.find_one({
                    "enquiry_no": enquiry_no.strip(),
                    "deleted_at": {"$exists": False}
                }, {"_id": 0})
                if existing:
                    match_type = "enquiry_no"
            
            # STEP 2: If no enquiry match, try Phone
            if not existing and normalized_phone and len(normalized_phone) >= 10:
                phone_matches = await db.leads.find({
                    "$or": [
                        {"phone_number": normalized_phone},
                        {"phone_number": {"$regex": f"{normalized_phone}$"}}
                    ],
                    "deleted_at": {"$exists": False},
                    "$or": [
                        {"is_duplicate": {"$exists": False}},
                        {"is_duplicate": False}
                    ]
                }, {"_id": 0}).to_list(10)
                
                if phone_matches:
                    for match in phone_matches:
                        existing_stage = match.get('enquiry_stage', '')
                        existing_kva = match.get('kva')
                        
                        if is_lead_closed(existing_stage):
                            # CLOSED - create NEW lost lead
                            existing = None
                            match_type = None
                            break
                        else:
                            # OPEN - check KVA
                            if compare_kva(existing_kva, kva):
                                # Same KVA - merge & close both as lost
                                existing = match
                                match_type = "phone_kva"
                                break
                            else:
                                # Different KVA - create NEW
                                existing = None
                                match_type = None
            
            # PROCESS based on match result
            if existing and match_type == "enquiry_no":
                existing_stage = existing.get('enquiry_stage', '')
                
                if is_lead_won(existing_stage):
                    # WON - do nothing
                    skipped_won_count += 1
                    continue
                    
                elif is_lead_lost(existing_stage):
                    # Already LOST - merge data but keep status
                    updates = merge_lead_data(existing, lead_data)
                    if updates:
                        updates['updated_at'] = now
                        await db.leads.update_one(
                            {"lead_id": existing["lead_id"]},
                            {"$set": updates}
                        )
                    skipped_already_lost_count += 1
                    continue
                    
                else:
                    # OPEN or OTHER CLOSED - update to Closed-Lost
                    updates = merge_lead_data(existing, lead_data)
                    updates['enquiry_stage'] = 'Closed-Lost'
                    updates['enquiry_status'] = 'Closed'
                    updates['closure_type'] = 'lost'
                    updates['updated_at'] = now
                    updates['lost_upload_batch_id'] = upload_batch_id
                    
                    # Check if needs closure questions
                    if updates.get('competitor') or updates.get('lost_reason') or updates.get('lost_remarks'):
                        updates['needs_closure_questions'] = False
                    else:
                        updates['needs_closure_questions'] = True
                    
                    merged = {**existing, **updates}
                    updates['is_qualified'] = calculate_qualified_status(merged)
                    
                    await db.leads.update_one(
                        {"lead_id": existing["lead_id"]},
                        {"$set": updates}
                    )
                    updated_count += 1
                    
            elif existing and match_type == "phone_kva":
                # OPEN lead with same KVA - merge & close as lost
                updates = merge_lead_data(existing, lead_data)
                updates['enquiry_stage'] = 'Closed-Lost'
                updates['enquiry_status'] = 'Closed'
                updates['closure_type'] = 'lost'
                updates['updated_at'] = now
                updates['lost_upload_batch_id'] = upload_batch_id
                
                if updates.get('competitor') or updates.get('lost_reason') or updates.get('lost_remarks'):
                    updates['needs_closure_questions'] = False
                else:
                    updates['needs_closure_questions'] = True
                
                merged = {**existing, **updates}
                updates['is_qualified'] = calculate_qualified_status(merged)
                
                await db.leads.update_one(
                    {"lead_id": existing["lead_id"]},
                    {"$set": updates}
                )
                updated_count += 1
                
            else:
                # No match or CLOSED or different KVA - Create NEW Closed-Lost lead
                uploader_name = current_user.name or current_user.email or "Unknown"
                
                lead_data['enquiry_stage'] = 'Closed-Lost'
                lead_data['enquiry_status'] = 'Closed'
                lead_data['closure_type'] = 'lost'
                
                if lead_data.get('competitor') or lead_data.get('lost_reason') or lead_data.get('lost_remarks'):
                    lead_data['needs_closure_questions'] = False
                else:
                    lead_data['needs_closure_questions'] = True
                
                # Use enquiry_date from file or lost_date
                if not lead_data.get('enquiry_date'):
                    lead_data['enquiry_date'] = lead_data.get('lost_date')
                
                lead_doc = {
                    "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                    **lead_data,
                    "is_qualified": calculate_qualified_status(lead_data),
                    "added_by": f"Lost Upload - {uploader_name}",
                    "upload_batch_id": upload_batch_id,
                    "lost_upload_batch_id": upload_batch_id,
                    "created_at": now,
                    "updated_at": now
                }
                
                await db.leads.insert_one(lead_doc)
                created_count += 1
                
        except Exception as e:
            logger.error(f"Lost upload row {idx + 2} error: {e}")
            errors.append({"row": idx + 2, "error": str(e)})
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="lost_upload",
        resource_type="lead",
        details={
            "upload_batch_id": upload_batch_id,
            "filename": filename,
            "created": created_count,
            "updated": updated_count,
            "skipped_won": skipped_won_count,
            "skipped_already_lost": skipped_already_lost_count,
            "errors": len(errors)
        }
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {
        "success": True,
        "template_type": "LOST",
        "created": created_count,
        "updated": updated_count,
        "skipped_won": skipped_won_count,
        "skipped_already_lost": skipped_already_lost_count,
        "total_rows": len(df),
        "errors": errors[:10] if errors else [],
        "total_errors": len(errors),
        "message": f"Lost Upload: {created_count} created, {updated_count} updated to lost, {skipped_won_count} won skipped, {skipped_already_lost_count} already lost"
    }


# ============================================
# SO UPLOAD PROCESSOR
# ============================================

async def process_so_upload(db, df: pd.DataFrame, current_user: User, filename: str):
    """
    Process SO Upload with logic:
    1. Match by Enquiry Number:
       - OPEN → Update to Closed-Won + add SO info
       - CLOSED-WON → Check SO info, add if missing; if different SO# create NEW
       - CLOSED-LOST/OTHER → Update to Closed-Won + add SO info
    2. No match → Match by Phone:
       - OPEN + KVA SAME → Update to Closed-Won
       - OPEN + KVA DIFFERENT → Create NEW Closed-Won
       - CLOSED-WON + KVA SAME + no SO → Add SO info
       - CLOSED-WON + KVA SAME + diff SO → Create NEW
       - CLOSED-LOST/OTHER → Create NEW Closed-Won
    3. No match → Create NEW Closed-Won lead
    """
    upload_batch_id = f"so_upload_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    created_count = 0
    updated_count = 0
    so_info_added_count = 0
    skipped_count = 0
    errors = []
    
    # Track processed entries
    processed_enquiry_nos = {}
    
    for idx, row in df.iterrows():
        try:
            lead_data = map_row_to_lead(row, SO_UPLOAD_MAPPING)
            
            if not lead_data:
                continue
            
            enquiry_no = lead_data.get('enquiry_no')
            phone_number = lead_data.get('phone_number')
            kva = lead_data.get('kva')
            sales_order_no = lead_data.get('sales_order_no')
            
            # Skip if no SO number
            if not sales_order_no:
                continue
            
            # Normalize phone
            normalized_phone = normalize_phone(phone_number)
            if normalized_phone:
                lead_data['phone_number'] = normalized_phone
            
            # Parse dates
            for date_field in ['sales_order_date', 'enquiry_date', 'po_date', 'invoice_date', 'dispatch_date', 'oem_order_date', 'quotation_date']:
                if lead_data.get(date_field):
                    lead_data[date_field] = parse_date(lead_data[date_field])
            
            # Check for duplicates in same file
            if enquiry_no and enquiry_no in processed_enquiry_nos:
                prev = processed_enquiry_nos[enquiry_no]
                current_data_count = get_row_data_count(lead_data)
                if current_data_count <= prev['data_count']:
                    continue
            
            if enquiry_no:
                processed_enquiry_nos[enquiry_no] = {
                    'row_idx': idx,
                    'data_count': get_row_data_count(lead_data)
                }
            
            # STEP 1: Match by Enquiry Number
            existing = None
            match_type = None
            
            if enquiry_no:
                existing = await db.leads.find_one({
                    "enquiry_no": enquiry_no.strip(),
                    "deleted_at": {"$exists": False}
                }, {"_id": 0})
                if existing:
                    match_type = "enquiry_no"
            
            # STEP 2: If no enquiry match, try Phone
            if not existing and normalized_phone and len(normalized_phone) >= 10:
                phone_matches = await db.leads.find({
                    "$or": [
                        {"phone_number": normalized_phone},
                        {"phone_number": {"$regex": f"{normalized_phone}$"}}
                    ],
                    "deleted_at": {"$exists": False},
                    "$or": [
                        {"is_duplicate": {"$exists": False}},
                        {"is_duplicate": False}
                    ]
                }, {"_id": 0}).to_list(10)
                
                if phone_matches:
                    for match in phone_matches:
                        existing_stage = match.get('enquiry_stage', '')
                        existing_kva = match.get('kva')
                        existing_so = match.get('sales_order_no')
                        
                        if is_lead_won(existing_stage):
                            # Already WON - check KVA and SO
                            if compare_kva(existing_kva, kva):
                                if not existing_so:
                                    # Same KVA, no SO - add SO info
                                    existing = match
                                    match_type = "phone_won_no_so"
                                    break
                                elif existing_so != sales_order_no:
                                    # Different SO - create NEW
                                    existing = None
                                    match_type = None
                                    break
                                else:
                                    # Same SO - skip
                                    existing = match
                                    match_type = "phone_same_so"
                                    break
                            else:
                                # Different KVA - create NEW
                                existing = None
                                match_type = None
                                
                        elif is_lead_closed(existing_stage):
                            # LOST or other CLOSED - create NEW
                            existing = None
                            match_type = None
                            break
                            
                        else:
                            # OPEN - check KVA
                            if compare_kva(existing_kva, kva):
                                # Same KVA - update to Won
                                existing = match
                                match_type = "phone_kva"
                                break
                            else:
                                # Different KVA - create NEW
                                existing = None
                                match_type = None
            
            # PROCESS based on match result
            if existing and match_type == "enquiry_no":
                existing_stage = existing.get('enquiry_stage', '')
                existing_so = existing.get('sales_order_no')
                
                if is_lead_won(existing_stage):
                    if not existing_so:
                        # Won but no SO info - add it
                        updates = merge_lead_data(existing, lead_data)
                        updates['sales_order_no'] = sales_order_no
                        updates['has_so_record'] = True
                        updates['updated_at'] = now
                        updates['so_upload_batch_id'] = upload_batch_id
                        
                        await db.leads.update_one(
                            {"lead_id": existing["lead_id"]},
                            {"$set": updates}
                        )
                        so_info_added_count += 1
                    elif existing_so != sales_order_no:
                        # Different SO number - create NEW won lead
                        uploader_name = current_user.name or current_user.email or "Unknown"
                        
                        lead_data['enquiry_stage'] = 'Closed-Won'
                        lead_data['enquiry_status'] = 'Closed'
                        lead_data['closure_type'] = 'won'
                        lead_data['has_so_record'] = True
                        
                        lead_doc = {
                            "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                            **lead_data,
                            "is_qualified": calculate_qualified_status(lead_data),
                            "added_by": f"SO Upload - {uploader_name}",
                            "upload_batch_id": upload_batch_id,
                            "so_upload_batch_id": upload_batch_id,
                            "created_at": now,
                            "updated_at": now
                        }
                        
                        await db.leads.insert_one(lead_doc)
                        created_count += 1
                    else:
                        # Same SO - skip
                        skipped_count += 1
                else:
                    # OPEN or LOST - update to Won
                    updates = merge_lead_data(existing, lead_data)
                    updates['enquiry_stage'] = 'Closed-Won'
                    updates['enquiry_status'] = 'Closed'
                    updates['closure_type'] = 'won'
                    updates['has_so_record'] = True
                    updates['sales_order_no'] = sales_order_no
                    updates['updated_at'] = now
                    updates['so_upload_batch_id'] = upload_batch_id
                    
                    merged = {**existing, **updates}
                    updates['is_qualified'] = calculate_qualified_status(merged)
                    
                    await db.leads.update_one(
                        {"lead_id": existing["lead_id"]},
                        {"$set": updates}
                    )
                    updated_count += 1
                    
            elif existing and match_type == "phone_kva":
                # OPEN with same KVA - update to Won
                updates = merge_lead_data(existing, lead_data)
                updates['enquiry_stage'] = 'Closed-Won'
                updates['enquiry_status'] = 'Closed'
                updates['closure_type'] = 'won'
                updates['has_so_record'] = True
                updates['sales_order_no'] = sales_order_no
                updates['updated_at'] = now
                updates['so_upload_batch_id'] = upload_batch_id
                
                merged = {**existing, **updates}
                updates['is_qualified'] = calculate_qualified_status(merged)
                
                await db.leads.update_one(
                    {"lead_id": existing["lead_id"]},
                    {"$set": updates}
                )
                updated_count += 1
                
            elif existing and match_type == "phone_won_no_so":
                # Won but no SO - add SO info
                updates = merge_lead_data(existing, lead_data)
                updates['sales_order_no'] = sales_order_no
                updates['has_so_record'] = True
                updates['updated_at'] = now
                updates['so_upload_batch_id'] = upload_batch_id
                
                await db.leads.update_one(
                    {"lead_id": existing["lead_id"]},
                    {"$set": updates}
                )
                so_info_added_count += 1
                
            elif existing and match_type == "phone_same_so":
                # Same SO - skip
                skipped_count += 1
                
            else:
                # No match - create NEW Won lead
                uploader_name = current_user.name or current_user.email or "Unknown"
                
                lead_data['enquiry_stage'] = 'Closed-Won'
                lead_data['enquiry_status'] = 'Closed'
                lead_data['closure_type'] = 'won'
                lead_data['has_so_record'] = True
                
                lead_doc = {
                    "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                    **lead_data,
                    "is_qualified": calculate_qualified_status(lead_data),
                    "added_by": f"SO Upload - {uploader_name}",
                    "upload_batch_id": upload_batch_id,
                    "so_upload_batch_id": upload_batch_id,
                    "created_at": now,
                    "updated_at": now
                }
                
                await db.leads.insert_one(lead_doc)
                created_count += 1
                
        except Exception as e:
            logger.error(f"SO upload row {idx + 2} error: {e}")
            errors.append({"row": idx + 2, "error": str(e)})
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="so_upload",
        resource_type="lead",
        details={
            "upload_batch_id": upload_batch_id,
            "filename": filename,
            "created": created_count,
            "updated": updated_count,
            "so_info_added": so_info_added_count,
            "skipped": skipped_count,
            "errors": len(errors)
        }
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {
        "success": True,
        "template_type": "SO",
        "created": created_count,
        "updated": updated_count,
        "so_info_added": so_info_added_count,
        "skipped": skipped_count,
        "total_rows": len(df),
        "errors": errors[:10] if errors else [],
        "total_errors": len(errors),
        "message": f"SO Upload: {created_count} created, {updated_count} updated to won, {so_info_added_count} SO info added, {skipped_count} skipped"
    }


# ============================================
# REMARK UPLOAD PROCESSOR
# ============================================

async def process_remark_upload(db, df: pd.DataFrame, current_user: User, filename: str):
    """
    Process Remark Upload with logic:
    - Match by Enquiry Number ONLY
    - Update follow-up info, add to followup_history
    - Update last_followup_date only if file's date > existing
    - Skip if no match
    """
    upload_batch_id = f"remark_upload_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    updated_count = 0
    skipped_no_match_count = 0
    errors = []
    
    # Track processed enquiry numbers
    processed_enquiry_nos = {}
    
    for idx, row in df.iterrows():
        try:
            lead_data = map_row_to_lead(row, REMARK_UPLOAD_MAPPING)
            
            if not lead_data:
                continue
            
            enquiry_no = lead_data.get('enquiry_no')
            
            if not enquiry_no:
                skipped_no_match_count += 1
                continue
            
            # Parse dates
            last_followup_date = parse_date(lead_data.get('last_followup_date'))
            planned_followup_date = parse_date(lead_data.get('planned_followup_date'))
            
            # Check for duplicates in same file
            if enquiry_no in processed_enquiry_nos:
                prev = processed_enquiry_nos[enquiry_no]
                # Keep the one with more recent date
                if last_followup_date and prev.get('last_followup_date'):
                    if last_followup_date <= prev['last_followup_date']:
                        continue
            
            processed_enquiry_nos[enquiry_no] = {
                'row_idx': idx,
                'last_followup_date': last_followup_date
            }
            
            # Match by Enquiry Number ONLY
            existing = await db.leads.find_one({
                "enquiry_no": enquiry_no.strip(),
                "deleted_at": {"$exists": False}
            }, {"_id": 0})
            
            if not existing:
                skipped_no_match_count += 1
                continue
            
            # Prepare updates
            updates = {}
            
            # Create followup history entry
            followup_entry = {
                "date": last_followup_date,
                "remark": lead_data.get('last_followup_remark'),
                "next_followup_date": planned_followup_date,
                "next_followup_remark": lead_data.get('next_followup_remark'),
                "type": lead_data.get('contact_type'),
                "added_at": now,
                "added_by": f"Remark Upload - {current_user.name or current_user.email}"
            }
            
            # Get existing followup history
            existing_history = existing.get('followup_history', [])
            if not isinstance(existing_history, list):
                existing_history = []
            
            # Add to history
            existing_history.append(followup_entry)
            updates['followup_history'] = existing_history
            
            # Update last_followup_date only if file's date > existing
            existing_last_date = existing.get('last_followup_date')
            if last_followup_date:
                should_update_last_date = True
                if existing_last_date:
                    try:
                        existing_date_obj = datetime.strptime(existing_last_date, "%Y-%m-%d")
                        file_date_obj = datetime.strptime(last_followup_date, "%Y-%m-%d")
                        should_update_last_date = file_date_obj > existing_date_obj
                    except:
                        should_update_last_date = True
                
                if should_update_last_date:
                    updates['last_followup_date'] = last_followup_date
                    if lead_data.get('last_followup_remark'):
                        updates['last_followup_remark'] = lead_data['last_followup_remark']
            
            # Update planned followup (Next Follow Up)
            if planned_followup_date:
                updates['planned_followup_date'] = planned_followup_date
            if lead_data.get('next_followup_remark'):
                updates['next_followup_remark'] = lead_data['next_followup_remark']
            
            # Update contact type (last_contact_type)
            if lead_data.get('contact_type'):
                updates['last_contact_type'] = lead_data['contact_type']
            
            # Update no_of_followups
            if lead_data.get('no_of_followups'):
                updates['no_of_followups'] = lead_data['no_of_followups']
            
            # Update other fields if different and not empty
            other_fields = ['enquiry_status', 'enquiry_stage', 'employee_name', 'employee_code',
                           'customer_type', 'address', 'city', 'district', 'model', 'phase', 
                           'kva', 'qty', 'source', 'referred_by']
            
            for field in other_fields:
                if lead_data.get(field) and lead_data[field] != existing.get(field):
                    updates[field] = lead_data[field]
            
            updates['updated_at'] = now
            updates['remark_upload_batch_id'] = upload_batch_id
            
            # Apply updates
            await db.leads.update_one(
                {"lead_id": existing["lead_id"]},
                {"$set": updates}
            )
            updated_count += 1
            
        except Exception as e:
            logger.error(f"Remark upload row {idx + 2} error: {e}")
            errors.append({"row": idx + 2, "error": str(e)})
    
    # Log activity
    activity = ActivityLog(
        user_id=current_user.user_id,
        action="remark_upload",
        resource_type="lead",
        details={
            "upload_batch_id": upload_batch_id,
            "filename": filename,
            "updated": updated_count,
            "skipped_no_match": skipped_no_match_count,
            "errors": len(errors)
        }
    )
    activity_doc = activity.model_dump()
    activity_doc["created_at"] = activity_doc["created_at"].isoformat()
    await db.activity_logs.insert_one(activity_doc)
    
    return {
        "success": True,
        "template_type": "REMARK",
        "updated": updated_count,
        "skipped_no_match": skipped_no_match_count,
        "total_rows": len(df),
        "errors": errors[:10] if errors else [],
        "total_errors": len(errors),
        "message": f"Remark Upload: {updated_count} leads updated, {skipped_no_match_count} skipped (no matching enquiry number)"
    }


# ============================================
# TEMPLATE DOWNLOAD ENDPOINTS
# ============================================

@router.get("/templates/{template_type}")
async def download_template(
    template_type: str,
    current_user: User = Depends(get_current_user)
):
    """Download a template file with sample data"""
    from fastapi.responses import StreamingResponse
    
    template_type = template_type.upper()
    
    if template_type == 'LEAD':
        columns = [
            "Zone", "State", "Area Office", "Dealer", "Branch", "Location",
            "Employee Code", "Employee Name", "Employee Status",
            "Enquiry No", "Enquiry Date", "Customer Type", "Corporate Name",
            "Name", "Phone Number", "Email", "Address", "PinCode", "Tehsil", "District",
            "KVA", "Phase", "Qty", "Remarks",
            "EnquiryStatus", "EnquiryType", "Enquiry Stage",
            "EO/PO Date", "Planned Followup Date",
            "Source", "Source From", "Events", "No of Follow-ups",
            "Segment", "SubSegment", "DG Ownership",
            "Created By", "PAN NO.", "LastFollowupDate", "Enquiry Closure Date",
            "Finance Required", "Finance Company", "Referred By"
        ]
        sample_data = [
            ["North", "Delhi", "Delhi Office", "ABC Dealer", "Main Branch", "Connaught Place",
             "EMP001", "John Doe", "Active",
             "E2501ABC00001", "2025-01-15", "New Customer", "XYZ Corp",
             "Rahul Kumar", "9876543210", "rahul@example.com", "123 Main St", "110001", "Central", "New Delhi",
             "15", "Three", "1", "Interested in DG set",
             "Hot", "New", "Hot Prospecting",
             "2025-01-20", "2025-01-25",
             "Website", "Direct", "", "2",
             "Commercial", "Hospital", "New",
             "Admin", "ABCDE1234F", "2025-01-22", "",
             "No", "", ""]
        ]
        filename = "Lead_Upload_Template.xlsx"
        
    elif template_type == 'LOST':
        columns = [
            "Dealer", "Branch", "Employee Code", "Sales Executive",
            "Enquiry No.", "Enquiry Date", "Enquiry Source",
            "Segment", "Sub Segment", "Type", "Lost Date",
            "Model", "Phase", "KVA",
            "Prospect Name", "Phone / Mobile No", "Address", "Tehsil", "District",
            "Win Reason", "Win Remarks", "Latest Follow-up Remark", "Lost Remarks",
            "No Of Follow ups Done"
        ]
        sample_data = [
            ["ABC Dealer", "Main Branch", "EMP001", "John Doe",
             "E2501ABC00001", "2025-01-15", "Website",
             "Commercial", "Hospital", "Telephonic", "2025-01-28",
             "M2155G2", "Three", "15",
             "Rahul Kumar", "9876543210", "123 Main St", "Central", "New Delhi",
             "Kirloskar", "Better price offered", "Customer chose competitor", "Price was main factor",
             "5"]
        ]
        filename = "Lost_Upload_Template.xlsx"
        
    elif template_type == 'SO':
        columns = [
            "Zone", "State", "Dealer", "Branch",
            "Employee Code", "Employee Name", "Employee Status",
            "Sales Order Number", "Sales Order Date", "Sales Order Cancellation Date",
            "Sales Order Status", "Sales Order Ageing",
            "Model", "KVA", "Phase", "Qty", "Model Description",
            "Customer Code", "Customer Name", "Phone/Mobile Number",
            "Customer Address", "Tehsil", "District", "Pincode",
            "PO Number", "PO Date", "Installation in Scope",
            "Enquiry no", "Enquiry Date",
            "Quotation reference No", "Quotation Date", "Quotation Amount",
            "Stock Allocation Status", "Promise Delivery Date",
            "Invoice No", "Invoice Date", "Ageing",
            "OEM Order Date", "DispatchDate"
        ]
        sample_data = [
            ["North", "Delhi", "ABC Dealer", "Main Branch",
             "EMP001", "John Doe", "Active",
             "SO2501001", "2025-01-20", "",
             "Confirmed", "10",
             "M2155G2", "15", "Three", "1", "15 KVA DG Set",
             "CUST001", "Rahul Kumar", "9876543210",
             "123 Main St", "Central", "New Delhi", "110001",
             "PO2501001", "2025-01-18", "Yes",
             "E2501ABC00001", "2025-01-15",
             "QT2501001", "2025-01-16", "150000",
             "Allocated", "2025-02-01",
             "INV2501001", "2025-01-25", "5",
             "2025-01-21", "2025-01-28"]
        ]
        filename = "SO_Upload_Template.xlsx"
        
    elif template_type == 'REMARK':
        columns = [
            "Dealer Branch", "Employee Code", "Employee Name", "Employee Status",
            "Enquiry Number", "Enquiry Date", "Customer Type",
            "Name", "Address", "City", "Tehsil", "District",
            "Phone", "Email", "Mobile",
            "Model", "Phase", "KVA", "Quantity",
            "Last Followup Date", "Last Follow-up Remark",
            "Next Follow Up Date", "Next Follow Up Remark",
            "Enquiry Status", "Enquiry Stage", "Enquiry Ageing Days",
            "Enquiry Source", "Referred By",
            "No Of Followup", "Type", "Enquiry Not Followed From (No Of Days)", "FY"
        ]
        sample_data = [
            ["ABC Dealer", "EMP001", "John Doe", "Active",
             "E2501ABC00001", "2025-01-15", "New Customer",
             "Rahul Kumar", "123 Main St", "New Delhi", "Central", "New Delhi",
             "9876543210", "rahul@example.com", "9876543210",
             "M2155G2", "Three", "15", "1",
             "2025-01-22", "Customer interested, will confirm next week",
             "2025-01-29", "Follow up for confirmation",
             "Hot", "Hot Prospecting", "15",
             "Website", "",
             "3", "Telephonic", "7", "F25"]
        ]
        filename = "Remark_Upload_Template.xlsx"
        
    else:
        raise HTTPException(status_code=400, detail=f"Unknown template type: {template_type}")
    
    # Create DataFrame with proper structure
    df = pd.DataFrame(sample_data, columns=columns)
    
    output = io.BytesIO()
    # Use openpyxl engine explicitly for .xlsx files
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
