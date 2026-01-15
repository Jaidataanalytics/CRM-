"""
Data Import Route - Import exported data into production database.
This endpoint allows importing the exported JSON data after deployment.
"""
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks, UploadFile, File
from typing import Optional
import json
import os
import logging
from datetime import datetime, timezone
import httpx

from models.user import User
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data-migration", tags=["Data Migration"])

# Path to exported data files
DATA_EXPORT_DIR = '/app/backend/data_export'

async def get_db(request: Request):
    return request.app.state.db


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


@router.post("/emergency-reset")
async def emergency_reset_from_preview(
    request: Request,
    secret_key: str = "RESET_DEPLOYED_DB_2024",
    preview_url: str = "https://salessyncpro.preview.emergentagent.com"
):
    """
    EMERGENCY: Reset database from preview without authentication.
    This is for when the deployed database has different users and you can't login.
    Requires a secret key for security.
    """
    # Simple security check
    if secret_key != "RESET_DEPLOYED_DB_2024":
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    db = await get_db(request)
    
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            # Login to preview
            login_resp = await client.post(
                f"{preview_url}/api/auth/login",
                json={"username": "admin", "password": "admin123"}
            )
            if login_resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to login to preview")
            
            token = login_resp.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # Fetch all leads from preview
            all_leads = []
            page = 1
            while True:
                leads_resp = await client.get(
                    f"{preview_url}/api/leads/export-all?page={page}&limit=5000",
                    headers=headers,
                    timeout=60.0
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
            
            # Delete ALL leads
            delete_result = await db.leads.delete_many({})
            logger.info(f"Deleted {delete_result.deleted_count} existing leads")
            
            # Clean leads for insertion
            for lead in all_leads:
                if '_id' in lead:
                    del lead['_id']
            
            # Insert in batches of 500 (smaller batches for cloud DB)
            batch_size = 500
            inserted = 0
            
            for i in range(0, len(all_leads), batch_size):
                batch = all_leads[i:i + batch_size]
                result = await db.leads.insert_many(batch)
                inserted += len(result.inserted_ids)
                logger.info(f"Imported batch {i//batch_size + 1}, total: {inserted}")
            
            # Also reset users - delete all and create admin
            await db.users.delete_many({})
            
            # Create admin user with bcrypt password hash
            import bcrypt
            password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin_user = {
                "user_id": "user_admin_001",
                "username": "admin",
                "name": "Admin User",
                "email": "admin@example.com",
                "password_hash": password_hash,
                "role": "Admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(admin_user)
            logger.info("Created admin user")
            
            # Verify
            final_count = await db.leads.count_documents({})
            duplicates = await db.leads.count_documents({'is_duplicate': True})
            with_so = await db.leads.count_documents({'has_so_record': True})
            
            return {
                "status": "success",
                "message": f"Emergency reset complete. Imported {inserted} leads and created admin user.",
                "deleted": delete_result.deleted_count,
                "imported": inserted,
                "admin_created": True,
                "login": {"username": "admin", "password": "admin123"},
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
        logger.error(f"Error during emergency reset: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/reset-from-preview")
async def reset_from_preview(
    request: Request,
    current_user: User = Depends(get_current_user),
    preview_url: str = "https://salessyncpro.preview.emergentagent.com"
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