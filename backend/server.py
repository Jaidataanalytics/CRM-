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

# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "Lead Management Dashboard API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

# Include the router in the main app
app.include_router(api_router)

# Store db in app state for route access
app.state.db = db

# Configure CORS
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    # When credentials are allowed, we need specific origins
    cors_origins = [
        "http://localhost:3000",
        "https://leadforge-dash.preview.emergentagent.com"
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

@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting Lead Management Dashboard API...")
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
