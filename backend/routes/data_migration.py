"""
Data Import Route - Import exported data into production database.
This endpoint allows importing the exported JSON data after deployment.
"""
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from typing import Optional
import json
import os
import logging
from datetime import datetime, timezone

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
    if current_user.role != "admin":
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
    if current_user.role != "admin":
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
    if current_user.role != "admin":
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
