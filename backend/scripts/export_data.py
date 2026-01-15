#!/usr/bin/env python3
"""
Data Export Script - Exports all MongoDB data to JSON files for production migration.
This script exports data from the preview database to JSON files that can be imported
into production after deployment.
"""
import asyncio
import json
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Custom JSON encoder to handle ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

async def export_collection(db, collection_name: str, output_dir: str):
    """Export a single collection to JSON file"""
    collection = db[collection_name]
    
    # Get all documents, excluding _id from export (will be regenerated on import)
    cursor = collection.find({})
    documents = []
    
    async for doc in cursor:
        # Remove _id as it will be regenerated
        if '_id' in doc:
            del doc['_id']
        documents.append(doc)
    
    output_file = os.path.join(output_dir, f"{collection_name}.json")
    
    with open(output_file, 'w') as f:
        json.dump(documents, f, cls=MongoJSONEncoder, indent=None)
    
    print(f"✓ Exported {len(documents)} documents from '{collection_name}'")
    return len(documents)

async def main():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Output directory
    output_dir = '/app/backend/data_export'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n{'='*60}")
    print(f"DATA EXPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Database: {db_name}")
    print(f"Output: {output_dir}")
    print(f"{'='*60}\n")
    
    # Collections to export
    collections = [
        'leads',
        'users', 
        'metric_settings',
        'closure_questions',
        'qualification_questions',
        'qualification_settings',
        'saved_forecasts',
        'entity_profile_config',
        'migration_status',
    ]
    
    total_docs = 0
    
    for collection_name in collections:
        try:
            count = await export_collection(db, collection_name, output_dir)
            total_docs += count
        except Exception as e:
            print(f"✗ Error exporting '{collection_name}': {e}")
    
    # Create metadata file
    metadata = {
        'export_date': datetime.now().isoformat(),
        'source_db': db_name,
        'collections': collections,
        'total_documents': total_docs
    }
    
    with open(os.path.join(output_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"EXPORT COMPLETE")
    print(f"Total documents exported: {total_docs}")
    print(f"Files saved to: {output_dir}")
    print(f"{'='*60}\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
