"""
Script to seed the database with sample lead data from the Excel file.
"""
import asyncio
import os
import io
from datetime import datetime, timezone
import uuid
import pandas as pd
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

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
        for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return val
    return str(val)


async def seed_data():
    """Download and seed the sample data"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Download the Excel file
    url = "https://customer-assets.emergentagent.com/job_trackhub-17/artifacts/pdet7qc1_azdfs.xlsx"
    
    print(f"Downloading sample data from {url}...")
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(url)
        content = response.content
    
    # Parse Excel
    print("Parsing Excel file...")
    df = pd.read_excel(io.BytesIO(content))
    print(f"Found {len(df)} rows")
    
    # Clear existing leads
    await db.leads.delete_many({})
    print("Cleared existing leads")
    
    # Process and insert leads
    leads_to_insert = []
    
    for idx, row in df.iterrows():
        try:
            lead_data = {
                "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
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
                        lead_data[db_field] = clean_value(val)
            
            leads_to_insert.append(lead_data)
            
        except Exception as e:
            print(f"Error processing row {idx}: {e}")
            continue
    
    # Insert all leads
    if leads_to_insert:
        result = await db.leads.insert_many(leads_to_insert)
        print(f"Inserted {len(result.inserted_ids)} leads")
    
    # Create a default admin user
    admin_user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": "admin@leadforge.com",
        "name": "Admin User",
        "role": "Admin",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if admin exists
    existing = await db.users.find_one({"email": "admin@leadforge.com"})
    if not existing:
        await db.users.insert_one(admin_user)
        print("Created default admin user")
    
    # Print stats
    lead_count = await db.leads.count_documents({})
    user_count = await db.users.count_documents({})
    
    print(f"\n=== Database Stats ===")
    print(f"Total Leads: {lead_count}")
    print(f"Total Users: {user_count}")
    
    # Print sample data
    sample = await db.leads.find_one({}, {"_id": 0})
    if sample:
        print(f"\nSample Lead Keys: {list(sample.keys())[:10]}")
    
    client.close()
    print("\nSeeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_data())
