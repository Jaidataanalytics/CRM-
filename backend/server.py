from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
from routes.insights import router as insights_router
from routes.upload import router as upload_router
from routes.qualification import router as qualification_router
from routes.lead_activity import router as lead_activity_router
from routes.metric_settings import router as metric_settings_router
from routes.notifications import router as notifications_router

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(leads_router)
api_router.include_router(kpis_router)
api_router.include_router(filters_router)
api_router.include_router(admin_router)
api_router.include_router(forecast_router)
api_router.include_router(insights_router)
api_router.include_router(upload_router)
api_router.include_router(qualification_router)
api_router.include_router(lead_activity_router)
api_router.include_router(notifications_router)
api_router.include_router(metric_settings_router)

# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "Lead Management Dashboard API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

# Include the router in the main app
app.include_router(api_router)

# Root-level health check endpoint for Kubernetes probes (without /api prefix)
@app.get("/health")
async def kubernetes_health_check():
    return {"status": "healthy", "database": "connected"}

# Store db in app state for route access
app.state.db = db

# Configure CORS
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    # When credentials are allowed, we need specific origins
    cors_origins = [
        "http://localhost:3000",
        "https://lead-tracker-66.preview.emergentagent.com"
    ]
else:
    cors_origins = cors_origins.split(',')

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
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


@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting Lead Management Dashboard API...")
    
    # Run database migrations first
    await migrate_metric_settings()
    
    # Create indexes for better query performance
    await db.leads.create_index("lead_id", unique=True)
    await db.leads.create_index("enquiry_no")
    await db.leads.create_index("state")
    await db.leads.create_index("dealer")
    await db.leads.create_index("employee_name")
    await db.leads.create_index("segment")
    await db.leads.create_index("enquiry_status")
    await db.leads.create_index("enquiry_date")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.activity_logs.create_index("user_id")
    await db.activity_logs.create_index("created_at")
    logger.info("Database indexes created successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
