"""
Data Import Route - Import exported data into production database.
This endpoint allows importing the exported JSON data after deployment.
"""
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks, UploadFile, File
from typing import Optional, Dict, List, Any
import json
import os
import re
import logging
from datetime import datetime, timezone
from collections import Counter
import httpx

from models.user import User
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data-migration", tags=["Data Migration"])

# Path to exported data files
DATA_EXPORT_DIR = '/app/backend/data_export'

# Closed stages (merge ends at these)
CLOSED_STAGES = [
    'Closed-Won', 'Closed-Lost', 'Closed-Dropped', 
    'Order Booked', 'Lost', 'Dropped'
]

# Stage hierarchy (higher = more advanced)
STAGE_HIERARCHY = {
    'Prospecting': 1,
    'Qualified': 2,
    'Quotation': 3,
    'Quotation Sent': 3,
    'Negotiation': 4,
    'Closed-Lost': 5,
    'Closed-Dropped': 5,
    'Lost': 5,
    'Dropped': 5,
    'Closed-Won': 6,
    'Order Booked': 7
}

async def get_db(request: Request):
    return request.app.state.db


def normalize_text(text: str) -> str:
    """Normalize text for comparison"""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text).lower().strip())

def clean_phone_number(phone: Any) -> str:
    """Clean and normalize phone number"""
    if not phone:
        return ""
    phone_str = str(phone)
    phone_str = re.sub(r'^(\+91|91|0)', '', phone_str)
    phone_str = re.sub(r'[^0-9]', '', phone_str)
    if len(phone_str) > 10:
        phone_str = phone_str[-10:]
    return phone_str

def split_concatenated_field(value: str) -> List[str]:
    """Split concatenated field into parts"""
    if not value:
        return []
    parts = re.split(r'\s*\|\s*', str(value))
    return [p.strip() for p in parts if p.strip()]

def deduplicate_remarks(remarks_list: List[tuple]) -> str:
    """Deduplicate remarks and format them"""
    if not remarks_list:
        return ""
    remarks_list = [(r, d) for r, d in remarks_list if r and str(r).strip()]
    if not remarks_list:
        return ""
    
    unique_remarks = []
    seen_normalized = set()
    
    for remark, date in sorted(remarks_list, key=lambda x: x[1] or ''):
        normalized = normalize_text(remark)
        if normalized and normalized not in seen_normalized:
            seen_normalized.add(normalized)
            unique_remarks.append((str(remark).strip(), date))
    
    if len(unique_remarks) == 1:
        return unique_remarks[0][0]
    
    formatted = []
    for i, (remark, date) in enumerate(unique_remarks[:3], 1):
        formatted.append(f"Remark {i}: {remark}")
    
    return " | ".join(formatted)

def get_most_common_or_recent(values: List[tuple]) -> Any:
    """Get most repeated value, or most recent if tied"""
    if not values:
        return None
    valid_values = [(v, d) for v, d in values if v is not None and str(v).strip()]
    if not valid_values:
        return None
    
    counter = Counter(v for v, d in valid_values)
    most_common = counter.most_common()
    
    if len(most_common) == 1 or most_common[0][1] > most_common[1][1]:
        return most_common[0][0]
    
    sorted_by_date = sorted(valid_values, key=lambda x: x[1] or '', reverse=True)
    return sorted_by_date[0][0]

def get_most_advanced_stage(stages: List[tuple]) -> str:
    """Get most advanced stage"""
    if not stages:
        return ""
    valid_stages = [(s, d) for s, d in stages if s and str(s).strip()]
    if not valid_stages:
        return ""
    
    def sort_key(item):
        stage, date = item
        return (STAGE_HIERARCHY.get(stage, 0), date or '')
    
    sorted_stages = sorted(valid_stages, key=sort_key, reverse=True)
    return sorted_stages[0][0]

def clean_single_lead(lead: Dict) -> Dict:
    """Clean a single lead"""
    cleaned = dict(lead)
    
    if 'phone_number' in cleaned:
        cleaned['phone_number'] = clean_phone_number(cleaned['phone_number'])
    
    text_fields = ['name', 'email_address', 'address', 'district', 'tehsil', 'pincode', 
                   'dealer', 'segment', 'employee_name', 'state', 'location']
    
    for field in text_fields:
        if field in cleaned and cleaned[field]:
            value = str(cleaned[field])
            if ' | ' in value or value.count(value[:20]) > 1:
                parts = split_concatenated_field(value)
                if parts:
                    counter = Counter(normalize_text(p) for p in parts)
                    most_common_normalized = counter.most_common(1)[0][0]
                    for p in parts:
                        if normalize_text(p) == most_common_normalized:
                            cleaned[field] = p
                            break
    
    if 'remarks' in cleaned and cleaned['remarks']:
        remarks = str(cleaned['remarks'])
        if ' | ' in remarks or len(remarks) > 500:
            parts = split_concatenated_field(remarks)
            unique_parts = []
            seen = set()
            for p in parts:
                normalized = normalize_text(p)
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    unique_parts.append(p)
            if unique_parts:
                if len(unique_parts) == 1:
                    cleaned['remarks'] = unique_parts[0]
                else:
                    cleaned['remarks'] = " | ".join(f"Remark {i+1}: {r}" for i, r in enumerate(unique_parts[:3]))
    
    return cleaned

def merge_leads_intelligently(leads: List[Dict]) -> Dict:
    """Merge multiple leads into one"""
    if not leads:
        return {}
    if len(leads) == 1:
        return clean_single_lead(leads[0])
    
    sorted_leads = sorted(leads, key=lambda x: x.get('enquiry_date') or '')
    primary_lead = sorted_leads[-1]
    merged = dict(primary_lead)
    
    remarks_with_dates = []
    numeric_fields = {'kva': [], 'qty': [], 'won_qty': []}
    text_fields = {
        'name': [], 'email_address': [], 'address': [], 'district': [], 
        'tehsil': [], 'pincode': [], 'dealer': [], 'segment': [], 
        'employee_name': [], 'state': [], 'location': [], 'phone_number': []
    }
    stages_with_dates = []
    
    for lead in sorted_leads:
        date = lead.get('enquiry_date') or ''
        
        if lead.get('remarks'):
            for part in split_concatenated_field(str(lead['remarks'])):
                remarks_with_dates.append((part, date))
        
        for field in numeric_fields:
            if lead.get(field) is not None:
                try:
                    val = float(lead[field])
                    if val > 0:
                        numeric_fields[field].append((val, date))
                except (ValueError, TypeError):
                    pass
        
        for field in text_fields:
            if lead.get(field):
                val = str(lead[field]).strip()
                if val:
                    text_fields[field].append((val, date))
        
        if lead.get('enquiry_stage'):
            stages_with_dates.append((lead['enquiry_stage'], date))
    
    merged['remarks'] = deduplicate_remarks(remarks_with_dates)
    
    for field, values in numeric_fields.items():
        if values:
            result = get_most_common_or_recent(values)
            if result is not None:
                merged[field] = result
    
    for field, values in text_fields.items():
        if values:
            if field == 'phone_number':
                values = [(clean_phone_number(v), d) for v, d in values]
            result = get_most_common_or_recent(values)
            if result:
                merged[field] = result
    
    if stages_with_dates:
        merged['enquiry_stage'] = get_most_advanced_stage(stages_with_dates)
    
    merged_enquiries = []
    for lead in sorted_leads[:-1]:
        merged_enquiries.append({
            'enquiry_no': lead.get('enquiry_no'),
            'enquiry_date': lead.get('enquiry_date'),
            'enquiry_stage': lead.get('enquiry_stage'),
            'enquiry_type': lead.get('enquiry_type'),
            'name': lead.get('name'),
            'kva': lead.get('kva'),
            'qty': lead.get('qty'),
            'remarks': lead.get('remarks', '')[:100] if lead.get('remarks') else ''
        })
    
    if merged_enquiries:
        merged['merged_enquiries'] = merged_enquiries
    
    return clean_single_lead(merged)


@router.post("/run-cleanup")
async def run_data_cleanup(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Run comprehensive data cleanup and merge on the current database.
    This cleans all leads and re-runs the intelligent merge logic.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    logger.info("Starting comprehensive data cleanup and merge...")
    
    # Step 1: Get all leads
    all_leads = await db.leads.find({}, {'_id': 0}).to_list(None)
    total_leads = len(all_leads)
    logger.info(f"Found {total_leads} total leads to process")
    
    # Step 2: Clean all existing leads
    cleaned_count = 0
    for lead in all_leads:
        cleaned = clean_single_lead(lead)
        if cleaned != lead:
            await db.leads.update_one(
                {'lead_id': lead['lead_id']},
                {'$set': cleaned}
            )
            cleaned_count += 1
    
    logger.info(f"Cleaned {cleaned_count} leads")
    
    # Step 3: Group leads by phone number
    phone_groups = {}
    for lead in all_leads:
        phone = clean_phone_number(lead.get('phone_number'))
        if phone and len(phone) >= 10:
            if phone not in phone_groups:
                phone_groups[phone] = []
            phone_groups[phone].append(lead)
    
    multi_lead_phones = {p: leads for p, leads in phone_groups.items() if len(leads) > 1}
    logger.info(f"Found {len(multi_lead_phones)} phone numbers with multiple leads")
    
    # Step 4: Process each phone group with chunk-based merge
    total_merged = 0
    total_marked_duplicate = 0
    
    for phone, leads in multi_lead_phones.items():
        sorted_leads = sorted(leads, key=lambda x: x.get('enquiry_date') or '')
        
        chunks = []
        current_chunk = []
        
        for lead in sorted_leads:
            current_chunk.append(lead)
            stage = lead.get('enquiry_stage', '')
            is_closed = stage in CLOSED_STAGES or stage.lower().startswith('closed')
            
            if is_closed:
                chunks.append(current_chunk)
                current_chunk = []
        
        if current_chunk:
            chunks.append(current_chunk)
        
        for chunk in chunks:
            if len(chunk) <= 1:
                continue
            
            last_lead = chunk[-1]
            last_stage = last_lead.get('enquiry_stage', '')
            has_closed_target = last_stage in CLOSED_STAGES or last_stage.lower().startswith('closed')
            
            if has_closed_target:
                merged = merge_leads_intelligently(chunk)
                
                await db.leads.update_one(
                    {'lead_id': last_lead['lead_id']},
                    {'$set': merged}
                )
                
                for lead in chunk[:-1]:
                    await db.leads.update_one(
                        {'lead_id': lead['lead_id']},
                        {'$set': {
                            'is_duplicate': True,
                            'duplicate_of': last_lead['lead_id'],
                            'merged_into': last_lead['lead_id']
                        }}
                    )
                    total_marked_duplicate += 1
                
                total_merged += 1
    
    logger.info(f"Merge complete: {total_merged} groups merged, {total_marked_duplicate} leads marked as duplicates")
    
    # Step 5: Final verification
    final_total = await db.leads.count_documents({})
    final_duplicates = await db.leads.count_documents({'is_duplicate': True})
    final_non_duplicates = final_total - final_duplicates
    
    # Record migration
    await db.migration_status.update_one(
        {"migration": "data_cleanup"},
        {
            "$set": {
                "migration": "data_cleanup",
                "last_run": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "total_leads": total_leads,
                    "cleaned": cleaned_count,
                    "merged_groups": total_merged,
                    "marked_duplicate": total_marked_duplicate,
                    "final_total": final_total,
                    "final_duplicates": final_duplicates,
                    "final_non_duplicates": final_non_duplicates
                }
            }
        },
        upsert=True
    )
    
    return {
        "status": "success",
        "message": f"Cleanup complete. Cleaned {cleaned_count} leads, merged {total_merged} groups.",
        "results": {
            "total_leads_processed": total_leads,
            "leads_cleaned": cleaned_count,
            "merge_groups_processed": total_merged,
            "leads_marked_duplicate": total_marked_duplicate,
            "final_total": final_total,
            "final_duplicates": final_duplicates,
            "final_non_duplicates": final_non_duplicates
        }
    }


@router.get("/status")
async def get_migration_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Check if exported data files exist and get current DB status"""
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    # Check if export files exist
    metadata_file = os.path.join(DATA_EXPORT_DIR, 'metadata.json')
    export_exists = os.path.exists(metadata_file)
    
    export_info = None
    if export_exists:
        with open(metadata_file, 'r') as f:
            export_info = json.load(f)
    
    # Get current DB counts
    current_counts = {
        'leads': await db.leads.count_documents({}),
        'users': await db.users.count_documents({}),
        'metric_settings': await db.metric_settings.count_documents({}),
    }
    
    return {
        "export_available": export_exists,
        "export_info": export_info,
        "current_db_counts": current_counts,
        "message": "Export data ready for import" if export_exists else "No export data found"
    }


@router.post("/import")
async def import_data(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    clear_existing: bool = True,
    collections: Optional[str] = None  # Comma-separated list, or None for all
):
    """
    Import exported data into database.
    
    Args:
        clear_existing: If True, clears existing data before import (recommended)
        collections: Comma-separated list of collections to import, or None for all
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    # Check if export files exist
    metadata_file = os.path.join(DATA_EXPORT_DIR, 'metadata.json')
    if not os.path.exists(metadata_file):
        raise HTTPException(status_code=404, detail="No export data found. Run export script first.")
    
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    
    # Determine which collections to import
    available_collections = metadata.get('collections', [])
    if collections:
        target_collections = [c.strip() for c in collections.split(',')]
        # Validate all requested collections exist
        for c in target_collections:
            if c not in available_collections:
                raise HTTPException(status_code=400, detail=f"Collection '{c}' not in export")
    else:
        target_collections = available_collections
    
    results = {}
    total_imported = 0
    
    for collection_name in target_collections:
        data_file = os.path.join(DATA_EXPORT_DIR, f'{collection_name}.json')
        
        if not os.path.exists(data_file):
            results[collection_name] = {"status": "skipped", "reason": "file not found"}
            continue
        
        try:
            # Load data
            with open(data_file, 'r') as f:
                documents = json.load(f)
            
            if not documents:
                results[collection_name] = {"status": "skipped", "reason": "empty collection"}
                continue
            
            collection = db[collection_name]
            
            # Clear existing data if requested
            if clear_existing:
                delete_result = await collection.delete_many({})
                logger.info(f"Cleared {delete_result.deleted_count} documents from {collection_name}")
            
            # Insert new data in batches
            batch_size = 1000
            inserted = 0
            
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                result = await collection.insert_many(batch)
                inserted += len(result.inserted_ids)
            
            results[collection_name] = {
                "status": "success",
                "imported": inserted,
                "cleared_existing": clear_existing
            }
            total_imported += inserted
            logger.info(f"Imported {inserted} documents into {collection_name}")
            
        except Exception as e:
            logger.error(f"Error importing {collection_name}: {e}")
            results[collection_name] = {"status": "error", "error": str(e)}
    
    # Record migration
    await db.migration_status.update_one(
        {"migration": "data_import"},
        {
            "$set": {
                "migration": "data_import",
                "last_run": datetime.now(timezone.utc).isoformat(),
                "source": metadata.get('export_date'),
                "collections_imported": target_collections,
                "total_documents": total_imported,
                "results": results
            }
        },
        upsert=True
    )
    
    return {
        "status": "complete",
        "total_imported": total_imported,
        "collections": results,
        "source_export_date": metadata.get('export_date')
    }


@router.post("/reset-and-import")
async def reset_and_import_all(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    DANGEROUS: Completely reset the database and import fresh data from export files.
    This will DELETE ALL existing data and replace with exported data.
    Use this to sync production with the correct dataset.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    # Check if export files exist
    leads_file = os.path.join(DATA_EXPORT_DIR, 'leads.json')
    if not os.path.exists(leads_file):
        raise HTTPException(status_code=404, detail="No export data found. Deploy from preview first.")
    
    results = {}
    
    try:
        # Step 1: Delete ALL leads
        delete_result = await db.leads.delete_many({})
        results['deleted_leads'] = delete_result.deleted_count
        logger.info(f"Deleted {delete_result.deleted_count} existing leads")
        
        # Step 2: Load and insert leads from export
        with open(leads_file, 'r') as f:
            leads = json.load(f)
        
        logger.info(f"Loaded {len(leads)} leads from export file")
        
        # Insert in batches
        batch_size = 1000
        inserted = 0
        
        for i in range(0, len(leads), batch_size):
            batch = leads[i:i + batch_size]
            result = await db.leads.insert_many(batch)
            inserted += len(result.inserted_ids)
            logger.info(f"Imported batch {i//batch_size + 1}, total: {inserted}")
        
        results['imported_leads'] = inserted
        
        # Step 3: Import other collections if they exist
        other_collections = ['metric_settings', 'qualification_settings']
        for coll_name in other_collections:
            coll_file = os.path.join(DATA_EXPORT_DIR, f'{coll_name}.json')
            if os.path.exists(coll_file):
                with open(coll_file, 'r') as f:
                    data = json.load(f)
                if data:
                    await db[coll_name].delete_many({})
                    await db[coll_name].insert_many(data)
                    results[f'imported_{coll_name}'] = len(data)
        
        # Step 4: Verify final counts
        final_count = await db.leads.count_documents({})
        duplicates = await db.leads.count_documents({'is_duplicate': True})
        with_so = await db.leads.count_documents({'has_so_record': True})
        
        results['verification'] = {
            'final_lead_count': final_count,
            'duplicates': duplicates,
            'non_duplicates': final_count - duplicates,
            'with_so_record': with_so
        }
        
        # Record migration
        await db.migration_status.update_one(
            {"migration": "reset_and_import"},
            {
                "$set": {
                    "migration": "reset_and_import",
                    "last_run": datetime.now(timezone.utc).isoformat(),
                    "results": results
                }
            },
            upsert=True
        )
        
        return {
            "status": "success",
            "message": f"Database reset complete. Imported {inserted} leads.",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error during reset and import: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/import-leads-only")
async def import_leads_only(
    request: Request,
    current_user: User = Depends(get_current_user),
    clear_existing: bool = True
):
    """
    Quick import of just leads collection (the main data).
    Use this if you only need to update the leads data.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    leads_file = os.path.join(DATA_EXPORT_DIR, 'leads.json')
    if not os.path.exists(leads_file):
        raise HTTPException(status_code=404, detail="Leads export file not found")
    
    # Load leads data
    with open(leads_file, 'r') as f:
        leads = json.load(f)
    
    logger.info(f"Loaded {len(leads)} leads from export file")
    
    # Clear existing leads if requested
    if clear_existing:
        delete_result = await db.leads.delete_many({})
        logger.info(f"Cleared {delete_result.deleted_count} existing leads")
    
    # Insert in batches
    batch_size = 1000
    inserted = 0
    
    for i in range(0, len(leads), batch_size):
        batch = leads[i:i + batch_size]
        result = await db.leads.insert_many(batch)
        inserted += len(result.inserted_ids)
        logger.info(f"Imported batch {i//batch_size + 1}, total: {inserted}")
    
    # Verify counts
    final_count = await db.leads.count_documents({})
    duplicates = await db.leads.count_documents({'is_duplicate': True})
    non_duplicates = await db.leads.count_documents({'is_duplicate': {'$ne': True}})
    
    return {
        "status": "success",
        "leads_imported": inserted,
        "final_count": final_count,
        "duplicates": duplicates,
        "non_duplicates": non_duplicates,
        "message": f"Successfully imported {inserted} leads"
    }


@router.post("/reset-from-preview")
async def reset_from_preview(
    request: Request,
    current_user: User = Depends(get_current_user),
    preview_url: str = "https://smartinsight-3.preview.emergentagent.com"
):
    """
    Fetch data from preview environment and import into this database.
    This is for syncing production with preview data.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    try:
        # Login to preview to get token
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Login
            login_resp = await client.post(
                f"{preview_url}/api/auth/login",
                json={"username": "admin", "password": "admin123"}
            )
            if login_resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to login to preview")
            
            token = login_resp.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # Get all leads from preview (paginated)
            all_leads = []
            page = 1
            while True:
                leads_resp = await client.get(
                    f"{preview_url}/api/leads/export-all?page={page}&limit=5000",
                    headers=headers
                )
                if leads_resp.status_code != 200:
                    # Try alternative endpoint
                    leads_resp = await client.get(
                        f"{preview_url}/api/leads?page={page}&limit=5000&include_duplicates=true",
                        headers=headers
                    )
                
                if leads_resp.status_code != 200:
                    break
                    
                data = leads_resp.json()
                leads = data.get("leads", [])
                if not leads:
                    break
                all_leads.extend(leads)
                
                if page >= data.get("pages", 1):
                    break
                page += 1
            
            if not all_leads:
                raise HTTPException(status_code=400, detail="No leads fetched from preview")
            
            logger.info(f"Fetched {len(all_leads)} leads from preview")
            
            # Delete all existing leads
            delete_result = await db.leads.delete_many({})
            logger.info(f"Deleted {delete_result.deleted_count} existing leads")
            
            # Clean leads for insertion (remove any _id fields)
            for lead in all_leads:
                if '_id' in lead:
                    del lead['_id']
            
            # Insert in batches
            batch_size = 1000
            inserted = 0
            
            for i in range(0, len(all_leads), batch_size):
                batch = all_leads[i:i + batch_size]
                result = await db.leads.insert_many(batch)
                inserted += len(result.inserted_ids)
                logger.info(f"Imported batch {i//batch_size + 1}, total: {inserted}")
            
            # Verify
            final_count = await db.leads.count_documents({})
            duplicates = await db.leads.count_documents({'is_duplicate': True})
            with_so = await db.leads.count_documents({'has_so_record': True})
            
            return {
                "status": "success",
                "message": f"Imported {inserted} leads from preview",
                "deleted": delete_result.deleted_count,
                "imported": inserted,
                "verification": {
                    "final_count": final_count,
                    "duplicates": duplicates,
                    "non_duplicates": final_count - duplicates,
                    "with_so_record": with_so
                }
            }
            
    except httpx.RequestError as e:
        logger.error(f"Network error: {e}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"Error during reset from preview: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/upload-and-import")
async def upload_and_import(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a JSON file with leads data and import it.
    The file should be the leads.json export file.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = await get_db(request)
    
    try:
        # Read the uploaded file
        content = await file.read()
        leads = json.loads(content)
        
        if not isinstance(leads, list):
            raise HTTPException(status_code=400, detail="File must contain a JSON array of leads")
        
        logger.info(f"Loaded {len(leads)} leads from uploaded file")
        
        # Delete all existing leads
        delete_result = await db.leads.delete_many({})
        logger.info(f"Deleted {delete_result.deleted_count} existing leads")
        
        # Clean leads for insertion
        for lead in leads:
            if '_id' in lead:
                del lead['_id']
        
        # Insert in batches
        batch_size = 1000
        inserted = 0
        
        for i in range(0, len(leads), batch_size):
            batch = leads[i:i + batch_size]
            result = await db.leads.insert_many(batch)
            inserted += len(result.inserted_ids)
        
        # Verify
        final_count = await db.leads.count_documents({})
        duplicates = await db.leads.count_documents({'is_duplicate': True})
        
        return {
            "status": "success",
            "message": f"Imported {inserted} leads from upload",
            "deleted": delete_result.deleted_count,
            "imported": inserted,
            "final_count": final_count,
            "duplicates": duplicates
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        logger.error(f"Error during upload import: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")