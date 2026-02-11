from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import logging
from pathlib import Path
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection with retry logic
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'lead_management')

logger.info(f"Connecting to MongoDB at: {mongo_url[:30]}... DB: {db_name}")

# Create client with connection timeout settings
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=30000,  # 30 second timeout for production
    connectTimeoutMS=30000,
    socketTimeoutMS=60000,
    retryWrites=True,
    retryReads=True,
    maxPoolSize=10,
    minPoolSize=1
)
db = client[db_name]

# Create the main app
app = FastAPI(
    title="Lead Management Dashboard API",
    description="API for managing leads, KPIs, forecasts, and user administration",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Import route modules
from routes.auth import router as auth_router
from routes.leads import router as leads_router
from routes.kpis import router as kpis_router
from routes.filters import router as filters_router
from routes.admin import router as admin_router
from routes.forecast import router as forecast_router
from routes.forecast_enhanced import router as forecast_enhanced_router
from routes.insights import router as insights_router
from routes.upload import router as upload_router
from routes.upload_v2 import router as upload_v2_router
from routes.qualification import router as qualification_router
from routes.lead_activity import router as lead_activity_router
from routes.metric_settings import router as metric_settings_router
from routes.notifications import router as notifications_router
from routes.entity_profile import router as entity_profile_router
from routes.trash import router as trash_router
from routes.dispatch import router as dispatch_router
from routes.data_migration import router as data_migration_router
from routes.market_potential import router as market_potential_router
from routes.tenders import router as tenders_router

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(leads_router)
api_router.include_router(kpis_router)
api_router.include_router(filters_router)
api_router.include_router(admin_router)
api_router.include_router(forecast_router)
api_router.include_router(forecast_enhanced_router)
api_router.include_router(insights_router)
api_router.include_router(upload_router)
api_router.include_router(upload_v2_router)
api_router.include_router(qualification_router)
api_router.include_router(lead_activity_router)
api_router.include_router(notifications_router)
api_router.include_router(metric_settings_router)
api_router.include_router(entity_profile_router)
api_router.include_router(trash_router)
api_router.include_router(dispatch_router)
api_router.include_router(data_migration_router)
api_router.include_router(market_potential_router)
api_router.include_router(tenders_router)

# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "Lead Management Dashboard API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    try:
        # Verify database connection is working
        await db.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# Include the router in the main app
app.include_router(api_router)

# Root-level health check endpoint for Kubernetes probes (without /api prefix)
@app.get("/health")
async def kubernetes_health_check():
    try:
        await db.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Kubernetes health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# Store db in app state for route access
app.state.db = db

# Configure CORS
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
if not cors_origins_env or cors_origins_env == '*':
    # For development/preview, allow common origins with credentials
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Add the preview URL dynamically from request origin
else:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.(emergentagent\.com|emergent\.host)",  # Allow all Emergent subdomains (both preview and deployed)
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def migrate_metric_settings():
    """
    Database migration to fix metric_settings documents missing required fields.
    This ensures all metrics have proper metric_type and related fields.
    """
    logger.info("Running metric_settings migration...")
    
    # Define the expected schema for each metric
    metric_schema = {
        "total_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": None,
            "field_values": []
        },
        "won_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_stage",
            "field_values": ["Closed-Won", "Order Booked"]
        },
        "lost_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_stage",
            "field_values": ["Closed-Lost", "Closed-Dropped"]
        },
        "open_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_stage",
            "field_values": ["Prospecting", "Qualified"]
        },
        "closed_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_status",
            "field_values": ["Closed", "Order Received"]
        },
        "hot_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_type",
            "field_values": ["Hot"]
        },
        "warm_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_type",
            "field_values": ["Warm"]
        },
        "cold_leads": {
            "metric_type": "count",
            "unit": "",
            "field_name": "enquiry_type",
            "field_values": ["Cold"]
        },
        "avg_lead_age": {
            "metric_type": "calculated",
            "unit": "days",
            "start_date_field": "enquiry_date",
            "end_date_field": "today",
            "filter_stages": ["Prospecting", "Qualified"]
        },
        "avg_closure_time": {
            "metric_type": "calculated",
            "unit": "days",
            "start_date_field": "enquiry_date",
            "end_date_field": "last_followup_date",
            "filter_stages": ["Closed-Won", "Order Booked", "Closed-Lost", "Closed-Dropped"]
        },
        "conversion_rate": {
            "metric_type": "formula",
            "unit": "%",
            "numerator_metric": "won_leads",
            "denominator_metric": "won_leads+lost_leads"
        }
    }
    
    migration_count = 0
    
    # Get all existing metrics
    existing_metrics = await db.metric_settings.find({}).to_list(100)
    existing_metric_ids = {m.get("metric_id") for m in existing_metrics}
    
    logger.info(f"Found {len(existing_metrics)} existing metrics: {existing_metric_ids}")
    
    # First, ensure critical metrics exist - create them if missing
    critical_metrics = ["avg_lead_age", "avg_closure_time", "conversion_rate"]
    for metric_id in critical_metrics:
        if metric_id not in existing_metric_ids:
            logger.info(f"Critical metric '{metric_id}' missing - creating it")
            # Create from DEFAULT_METRICS
            from models.metric_settings import DEFAULT_METRICS
            for default_metric in DEFAULT_METRICS:
                if default_metric.get("metric_id") == metric_id:
                    await db.metric_settings.insert_one({
                        **default_metric,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    })
                    migration_count += 1
                    logger.info(f"Created missing critical metric: {metric_id}")
                    break
    
    # Reload metrics after creation
    existing_metrics = await db.metric_settings.find({}).to_list(100)
    
    for metric in existing_metrics:
        metric_id = metric.get("metric_id")
        updates = {}
        
        # Check if metric_type is missing
        if not metric.get("metric_type"):
            # Try to get from schema, otherwise default to "count"
            if metric_id in metric_schema:
                updates["metric_type"] = metric_schema[metric_id]["metric_type"]
            elif metric.get("numerator_metric") or metric.get("denominator_metric"):
                updates["metric_type"] = "formula"
            elif metric.get("start_date_field") or metric.get("end_date_field"):
                updates["metric_type"] = "calculated"
            else:
                updates["metric_type"] = "count"
        
        # For known metrics, ensure all required fields exist
        if metric_id in metric_schema:
            schema = metric_schema[metric_id]
            for field, value in schema.items():
                if field not in metric or metric.get(field) is None:
                    updates[field] = value
        
        # For calculated metrics, ensure date fields exist
        if metric.get("metric_type") == "calculated" or updates.get("metric_type") == "calculated":
            if not metric.get("start_date_field") and "start_date_field" not in updates:
                updates["start_date_field"] = "enquiry_date"
            if not metric.get("end_date_field") and "end_date_field" not in updates:
                updates["end_date_field"] = "today"
            if not metric.get("filter_stages") and "filter_stages" not in updates:
                updates["filter_stages"] = []
        
        # For formula metrics, ensure numerator/denominator exist
        if metric.get("metric_type") == "formula" or updates.get("metric_type") == "formula":
            if not metric.get("numerator_metric") and "numerator_metric" not in updates:
                updates["numerator_metric"] = "won_leads"
            if not metric.get("denominator_metric") and "denominator_metric" not in updates:
                updates["denominator_metric"] = "total_leads"
        
        # Ensure unit field exists
        if "unit" not in metric and "unit" not in updates:
            if metric.get("metric_type") == "formula" or updates.get("metric_type") == "formula":
                updates["unit"] = "%"
            elif metric.get("metric_type") == "calculated" or updates.get("metric_type") == "calculated":
                updates["unit"] = "days"
            else:
                updates["unit"] = ""
        
        # Apply updates if any
        if updates:
            await db.metric_settings.update_one(
                {"metric_id": metric_id},
                {"$set": updates}
            )
            migration_count += 1
            logger.info(f"Migrated metric '{metric_id}': added fields {list(updates.keys())}")
    
    if migration_count > 0:
        logger.info(f"Migration complete: updated {migration_count} metric(s)")
    else:
        logger.info("Migration complete: no updates needed")


async def migrate_normalize_duplicates():
    """
    Automatic migration to normalize duplicate values in the database.
    Fixes case variations like OPEN/Open, FAULTY/Faulty, etc.
    """
    import re
    logger.info("Running data normalization migration...")
    
    # Status/enquiry_stage fixes
    status_fixes = {
        "OPEN": "Open",
        "open": "Open",
        "FAULTY": "Closed-Faulty",
        "faulty": "Closed-Faulty",
        "Faulty": "Closed-Faulty",
        "CLOSED-FAULTY": "Closed-Faulty",
        "closed-faulty": "Closed-Faulty",
        "LOST": "Closed-Lost",
        "lost": "Closed-Lost",
        "Lost": "Closed-Lost",
        "CLOSED-LOST": "Closed-Lost",
        "closed-lost": "Closed-Lost",
        "WON": "Closed-Won",
        "won": "Closed-Won",
        "Won": "Closed-Won",
        "CLOSED-WON": "Closed-Won",
        "closed-won": "Closed-Won",
        "ORDER BOOKED": "Order Booked",
        "order booked": "Order Booked",
        "PROSPECTING": "Prospecting",
        "prospecting": "Prospecting",
        "QUALIFIED": "Qualified",
        "qualified": "Qualified",
        "NEGOTIATION": "Negotiation",
        "negotiation": "Negotiation",
        "HOT": "Hot",
        "hot": "Hot",
        "WARM": "Warm",
        "warm": "Warm",
        "COLD": "Cold",
        "cold": "Cold",
        "NEW": "New",
        "new": "New",
        "PENDING": "Pending",
        "pending": "Pending",
        "CLOSED-DROPPED": "Closed-Dropped",
        "closed-dropped": "Closed-Dropped",
    }
    
    # Dealer fixes - common variations
    dealer_fixes = {
        "SKS ENTER PRISES": "SKS Enterprises",
        "SKS ENTERPRISES": "SKS Enterprises",
        "sks enterprises": "SKS Enterprises",
        "Sks Enterprises": "SKS Enterprises",
        "RK TYRE": "R K Tyres",
        "rk tyre": "R K Tyres",
        "Rk Tyre": "R K Tyres",
        "RK Tyres": "R K Tyres",
        "rk tyres": "R K Tyres",
        "R K TYRES": "R K Tyres",
        "J.B. ENTERPRISES": "J.B. Enterprises",
        "j.b. enterprises": "J.B. Enterprises",
        "J.B enterprises": "J.B. Enterprises",
        "jb enterprises": "J.B. Enterprises",
        "JB ENTERPRISES": "J.B. Enterprises",
        "J B ENTERPRISES": "J.B. Enterprises",
    }
    
    total_updated = 0
    
    try:
        # Apply status fixes
        for old_val, new_val in status_fixes.items():
            if old_val != new_val:
                result = await db.leads.update_many(
                    {"enquiry_stage": old_val},
                    {"$set": {"enquiry_stage": new_val}}
                )
                if result.modified_count > 0:
                    logger.info(f"Normalized enquiry_stage: '{old_val}' -> '{new_val}' ({result.modified_count} records)")
                    total_updated += result.modified_count
        
        # Apply dealer fixes
        for old_val, new_val in dealer_fixes.items():
            if old_val != new_val:
                result = await db.leads.update_many(
                    {"dealer": old_val},
                    {"$set": {"dealer": new_val}}
                )
                if result.modified_count > 0:
                    logger.info(f"Normalized dealer: '{old_val}' -> '{new_val}' ({result.modified_count} records)")
                    total_updated += result.modified_count
        
        # Additional: Normalize by finding similar values and merging them
        # Get all unique dealers and find duplicates with different cases
        unique_dealers = await db.leads.distinct("dealer")
        dealer_groups = {}
        for dealer in unique_dealers:
            if dealer:
                # Create a normalized key (lowercase, no extra spaces)
                key = re.sub(r'\s+', ' ', dealer.lower().strip())
                key = re.sub(r'[^a-z0-9\s]', '', key)
                if key not in dealer_groups:
                    dealer_groups[key] = []
                dealer_groups[key].append(dealer)
        
        # For groups with multiple values, normalize to the one with most records
        for key, dealers in dealer_groups.items():
            if len(dealers) > 1:
                # Find the most common variant
                counts = []
                for d in dealers:
                    count = await db.leads.count_documents({"dealer": d})
                    counts.append((d, count))
                counts.sort(key=lambda x: x[1], reverse=True)
                canonical = counts[0][0]
                
                # Update all variants to canonical
                for d, count in counts[1:]:
                    if count > 0:
                        result = await db.leads.update_many(
                            {"dealer": d},
                            {"$set": {"dealer": canonical}}
                        )
                        if result.modified_count > 0:
                            logger.info(f"Merged dealer: '{d}' -> '{canonical}' ({result.modified_count} records)")
                            total_updated += result.modified_count
        
        # Same for employee names
        unique_employees = await db.leads.distinct("employee_name")
        employee_groups = {}
        for emp in unique_employees:
            if emp:
                key = re.sub(r'\s+', ' ', emp.lower().strip())
                if key not in employee_groups:
                    employee_groups[key] = []
                employee_groups[key].append(emp)
        
        for key, employees in employee_groups.items():
            if len(employees) > 1:
                counts = []
                for e in employees:
                    count = await db.leads.count_documents({"employee_name": e})
                    counts.append((e, count))
                counts.sort(key=lambda x: x[1], reverse=True)
                canonical = counts[0][0]
                
                for e, count in counts[1:]:
                    if count > 0:
                        result = await db.leads.update_many(
                            {"employee_name": e},
                            {"$set": {"employee_name": canonical}}
                        )
                        if result.modified_count > 0:
                            logger.info(f"Merged employee: '{e}' -> '{canonical}' ({result.modified_count} records)")
                            total_updated += result.modified_count
        
        if total_updated > 0:
            logger.info(f"Data normalization complete: updated {total_updated} record(s)")
        else:
            logger.info("Data normalization complete: no duplicates found")
    except Exception as e:
        logger.error(f"Data normalization migration failed: {str(e)}")
        # Don't raise - allow server to start even if migration fails


async def migrate_detect_duplicates():
    """
    DISABLED - Duplicate detection is now triggered manually from the Admin UI.
    This function is kept for reference but does nothing on startup.
    
    Manual trigger available at: Admin > Data Management > Duplicate Leads > Run Detection
    API endpoint: POST /api/admin/run-duplicate-detection
    """
    logger.info("Duplicate detection migration disabled - use manual trigger in Admin UI")
    # Automatic duplicate detection on startup is disabled
    # Users can trigger it manually from the Data Management page
    pass


async def migrate_lost_leads_enquiry_date():
    """
    Migration to set enquiry_date = lost_date for existing lost leads that don't have enquiry_date.
    This ensures lost leads are properly included in date-based filters and KPIs.
    """
    logger.info("Running lost leads enquiry_date migration...")
    
    try:
        # Find lost leads without enquiry_date but with lost_date
        result = await db.leads.update_many(
            {
                "closure_type": "lost",
                "lost_date": {"$exists": True, "$ne": None},
                "$or": [
                    {"enquiry_date": {"$exists": False}},
                    {"enquiry_date": None},
                    {"enquiry_date": ""}
                ]
            },
            [
                {"$set": {"enquiry_date": "$lost_date"}}
            ]
        )
        
        if result.modified_count > 0:
            logger.info(f"Lost leads migration: Updated {result.modified_count} leads with enquiry_date from lost_date")
        else:
            logger.info("Lost leads migration: No updates needed")
            
    except Exception as e:
        logger.error(f"Lost leads enquiry_date migration failed: {str(e)}")
        # Don't raise - allow server to start even if migration fails


async def migrate_lost_leads_field_mapping():
    """
    Migration to fix field mappings for existing lost leads:
    1. If name is empty but corporate_name exists, copy corporate_name to name
    2. If location is empty but district exists, copy district to location
    
    This ensures existing data follows the correct mappings:
    - Prospect Name -> name
    - District -> location
    """
    logger.info("Running lost leads field mapping migration...")
    
    try:
        # Fix name field: copy from corporate_name if name is empty
        name_result = await db.leads.update_many(
            {
                "$or": [
                    {"name": {"$exists": False}},
                    {"name": None},
                    {"name": ""}
                ],
                "corporate_name": {"$exists": True, "$ne": None, "$ne": ""}
            },
            [
                {"$set": {"name": "$corporate_name"}}
            ]
        )
        
        if name_result.modified_count > 0:
            logger.info(f"Lost leads field mapping: Updated {name_result.modified_count} leads with name from corporate_name")
        
        # Fix location field: copy from district if location is empty
        location_result = await db.leads.update_many(
            {
                "$or": [
                    {"location": {"$exists": False}},
                    {"location": None},
                    {"location": ""}
                ],
                "district": {"$exists": True, "$ne": None, "$ne": ""}
            },
            [
                {"$set": {"location": "$district"}}
            ]
        )
        
        if location_result.modified_count > 0:
            logger.info(f"Lost leads field mapping: Updated {location_result.modified_count} leads with location from district")
        
        # Also check for area field as fallback for location
        area_result = await db.leads.update_many(
            {
                "$or": [
                    {"location": {"$exists": False}},
                    {"location": None},
                    {"location": ""}
                ],
                "area": {"$exists": True, "$ne": None, "$ne": ""}
            },
            [
                {"$set": {"location": "$area"}}
            ]
        )
        
        if area_result.modified_count > 0:
            logger.info(f"Lost leads field mapping: Updated {area_result.modified_count} leads with location from area")
        
        total_updates = name_result.modified_count + location_result.modified_count + area_result.modified_count
        if total_updates == 0:
            logger.info("Lost leads field mapping: No updates needed")
        else:
            logger.info(f"Lost leads field mapping complete: {total_updates} total updates")
            
    except Exception as e:
        logger.error(f"Lost leads field mapping migration failed: {str(e)}")
        # Don't raise - allow server to start even if migration fails



async def migrate_qualified_status():
    """
    Migration to calculate and set is_qualified for all leads.
    A lead is qualified if 50% or more of key fields are filled.
    """
    logger.info("Running qualified status migration...")
    
    try:
        from utils.duplicate_detector import update_qualified_status_migration
        
        # Check if we recently ran this migration
        migration_record = await db.migration_status.find_one({"migration": "qualified_status"})
        if migration_record:
            last_run = migration_record.get("last_run")
            if last_run:
                if isinstance(last_run, str):
                    last_run = datetime.fromisoformat(last_run.replace('Z', '+00:00'))
                
                # Skip if ran within last day
                if datetime.now(timezone.utc) - last_run < timedelta(days=1):
                    logger.info("Qualified status migration already ran recently, skipping...")
                    return
        
        result = await update_qualified_status_migration(db)
        
        # Record that we ran the migration
        await db.migration_status.update_one(
            {"migration": "qualified_status"},
            {
                "$set": {
                    "migration": "qualified_status",
                    "last_run": datetime.now(timezone.utc).isoformat(),
                    "result": result
                }
            },
            upsert=True
        )
        
        logger.info(f"Qualified status migration complete: {result.get('qualified', 0)} qualified, {result.get('not_qualified', 0)} not qualified")
        
    except Exception as e:
        logger.error(f"Qualified status migration failed: {str(e)}")
        # Don't raise - allow server to start even if migration fails


async def migrate_quotation_sent_flag():
    """
    Migration to auto-mark quotation_sent=True for leads that have quotation data.
    If a lead has quotation_no or quotation_date, it means a quotation was sent.
    """
    logger.info("Running quotation_sent flag migration...")
    
    try:
        # Update leads that have quotation data but quotation_sent is not True
        result = await db.leads.update_many(
            {
                "$and": [
                    {"$or": [
                        {"quotation_no": {"$exists": True, "$ne": None, "$ne": ""}},
                        {"quotation_date": {"$exists": True, "$ne": None, "$ne": ""}}
                    ]},
                    {"$or": [
                        {"quotation_sent": {"$exists": False}},
                        {"quotation_sent": False},
                        {"quotation_sent": None}
                    ]}
                ]
            },
            {"$set": {"quotation_sent": True}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Quotation sent flag migration: Auto-marked {result.modified_count} leads with quotation_sent=True")
        else:
            logger.info("Quotation sent flag migration: No updates needed")
            
    except Exception as e:
        logger.error(f"Quotation sent flag migration failed: {str(e)}")


async def run_heavy_migrations_background():
    """
    Run heavy migrations in the background to avoid blocking server startup.
    This allows the server to respond to health checks immediately.
    """
    # Small delay to let server fully start first
    await asyncio.sleep(5)
    
    try:
        logger.info("Starting background migrations...")
        
        # These are heavier migrations that can take time - run with timeout
        try:
            await asyncio.wait_for(migrate_detect_duplicates(), timeout=120)
        except asyncio.TimeoutError:
            logger.warning("Duplicate detection migration timed out - will retry next startup")
        
        try:
            await asyncio.wait_for(migrate_qualified_status(), timeout=60)
        except asyncio.TimeoutError:
            logger.warning("Qualified status migration timed out - will retry next startup")
        
        logger.info("Background migrations completed successfully")
    except Exception as e:
        logger.error(f"Error during background migrations: {str(e)}")


@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting Lead Management Dashboard API...")
    
    # Test database connection first
    try:
        # Try to ping the database to verify connection
        await client.admin.command('ping')
        logger.info("Successfully connected to MongoDB")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        logger.error("Server will start but database operations may fail")
        # Don't raise - let the server start anyway
        # Individual endpoints will handle connection errors
        return
    
    try:
        # Seed default admin user if not exists (only hash password if creating new user)
        existing_admin = await db.users.find_one({"username": "admin"})
        if not existing_admin:
            import bcrypt
            admin_password_hash = bcrypt.hashpw("admin".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin_user = {
                "user_id": "user_admin_default",
                "username": "admin",
                "email": "admin@sharda.com",
                "name": "Administrator",
                "role": "Admin",
                "password_hash": admin_password_hash,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(admin_user)
            logger.info("Default admin user created (username: admin, password: admin)")
        
        # Run FAST migrations synchronously (these are quick and essential)
        await migrate_metric_settings()
        await migrate_normalize_duplicates()
        await migrate_lost_leads_enquiry_date()
        await migrate_lost_leads_field_mapping()
        await migrate_quotation_sent_flag()
        
        # Create indexes for better query performance (including COMPOUND indexes for KPIs)
        # Single field indexes
        await db.leads.create_index("lead_id", unique=True)
        await db.leads.create_index("enquiry_no")
        await db.leads.create_index("state")
        await db.leads.create_index("dealer")
        await db.leads.create_index("employee_name")
        await db.leads.create_index("segment")
        await db.leads.create_index("enquiry_status")
        await db.leads.create_index("enquiry_date")
        await db.leads.create_index("is_duplicate")
        await db.leads.create_index("phone_number")
        await db.leads.create_index("location")
        await db.leads.create_index("enquiry_stage")
        await db.leads.create_index("enquiry_type")
        await db.leads.create_index("has_so_record")
        await db.leads.create_index("dispatch_status")
        
        # COMPOUND indexes for KPI queries (critical for performance)
        await db.leads.create_index([("is_duplicate", 1), ("enquiry_date", 1)])
        await db.leads.create_index([("enquiry_stage", 1), ("is_duplicate", 1)])
        await db.leads.create_index([("enquiry_status", 1), ("enquiry_type", 1)])
        await db.leads.create_index([("has_so_record", 1), ("enquiry_date", 1)])
        await db.leads.create_index([("dispatch_status", 1), ("enquiry_stage", 1)])
        
        # User related indexes
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.activity_logs.create_index("user_id")
        await db.activity_logs.create_index("created_at")
        logger.info("Database indexes created successfully")
        
        # Schedule HEAVY migrations to run in background (non-blocking)
        # This allows the server to respond to health checks immediately
        asyncio.create_task(run_heavy_migrations_background())
        logger.info("Heavy migrations scheduled to run in background")
        
    except Exception as e:
        logger.error(f"Error during startup migrations: {str(e)}")
        # Don't raise - let the server start anyway

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
