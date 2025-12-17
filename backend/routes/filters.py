from fastapi import APIRouter, Request, Depends, Query
from typing import Optional, List
import logging

from models.user import User
from routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/filters", tags=["Filters"])


async def get_db(request: Request):
    return request.app.state.db


@router.get("/zones")
async def get_zones(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all unique zones"""
    db = await get_db(request)
    zones = await db.leads.distinct("zone")
    return {"zones": [z for z in zones if z]}


@router.get("/states")
async def get_states(
    request: Request,
    current_user: User = Depends(get_current_user),
    zone: Optional[str] = None
):
    """Get states, optionally filtered by zone"""
    db = await get_db(request)
    query = {}
    if zone:
        query["zone"] = zone
    
    states = await db.leads.distinct("state", query)
    return {"states": sorted([s for s in states if s])}


@router.get("/areas")
async def get_areas(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None
):
    """Get areas, optionally filtered by state"""
    db = await get_db(request)
    query = {}
    if state:
        query["state"] = state
    
    areas = await db.leads.distinct("area", query)
    return {"areas": sorted([a for a in areas if a])}


@router.get("/dealers")
async def get_dealers(
    request: Request,
    current_user: User = Depends(get_current_user),
    state: Optional[str] = None,
    area: Optional[str] = None
):
    """Get dealers, optionally filtered by state and area"""
    db = await get_db(request)
    query = {}
    if state:
        query["state"] = state
    if area:
        query["area"] = area
    
    dealers = await db.leads.distinct("dealer", query)
    return {"dealers": sorted([d for d in dealers if d])}


@router.get("/employees")
async def get_employees(
    request: Request,
    current_user: User = Depends(get_current_user),
    dealer: Optional[str] = None
):
    """Get employees, optionally filtered by dealer"""
    db = await get_db(request)
    query = {}
    if dealer:
        query["dealer"] = dealer
    
    employees = await db.leads.distinct("employee_name", query)
    return {"employees": sorted([e for e in employees if e])}


@router.get("/segments")
async def get_segments(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all unique segments"""
    db = await get_db(request)
    segments = await db.leads.distinct("segment")
    return {"segments": sorted([s for s in segments if s])}


@router.get("/sub-segments")
async def get_sub_segments(
    request: Request,
    current_user: User = Depends(get_current_user),
    segment: Optional[str] = None
):
    """Get sub-segments, optionally filtered by segment"""
    db = await get_db(request)
    query = {}
    if segment:
        query["segment"] = segment
    
    sub_segments = await db.leads.distinct("sub_segment", query)
    return {"sub_segments": sorted([s for s in sub_segments if s])}


@router.get("/sources")
async def get_sources(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all unique sources"""
    db = await get_db(request)
    sources = await db.leads.distinct("source")
    return {"sources": sorted([s for s in sources if s])}


@router.get("/enquiry-statuses")
async def get_enquiry_statuses(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all enquiry statuses"""
    return {"statuses": ["Open", "Closed"]}


@router.get("/enquiry-stages")
async def get_enquiry_stages(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all enquiry stages"""
    return {"stages": ["Prospecting", "Qualified", "Proposal", "Negotiation", "Closed-Won", "Closed-Lost"]}


@router.get("/enquiry-types")
async def get_enquiry_types(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all enquiry types"""
    return {"types": ["Hot", "Warm", "Cold"]}

@router.get("/all")
async def get_all_filters(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get all filter options at once"""
    db = await get_db(request)
    
    states = await db.leads.distinct("state")
    dealers = await db.leads.distinct("dealer")
    areas = await db.leads.distinct("area")
    employees = await db.leads.distinct("employee_name")
    segments = await db.leads.distinct("segment")
    
    return {
        "states": sorted([s for s in states if s]),
        "dealers": sorted([d for d in dealers if d]),
        "areas": sorted([a for a in areas if a]),
        "employees": sorted([e for e in employees if e]),
        "segments": sorted([s for s in segments if s])
    }
