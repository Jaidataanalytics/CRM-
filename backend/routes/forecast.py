from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timezone
import logging
import os

from models.user import User, UserRole
from routes.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forecast", tags=["Forecast"])


async def get_db(request: Request):
    return request.app.state.db


@router.post("")
async def generate_forecast(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Generate AI-powered forecast using GPT-4o"""
    db = await get_db(request)
    body = await request.json()
    
    horizon = body.get("horizon", 3)  # 3, 6, or 12 months
    state = body.get("state")
    dealer = body.get("dealer")
    location = body.get("location")
    
    if horizon not in [3, 6, 12]:
        raise HTTPException(status_code=400, detail="Horizon must be 3, 6, or 12 months")
    
    # Build query for historical data
    query = {}
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if location:
        query["location"] = location
    
    # Get historical data grouped by month
    pipeline = [
        {"$match": query},
        {
            "$addFields": {
                "month": {"$substr": ["$enquiry_date", 0, 7]}  # Extract YYYY-MM
            }
        },
        {
            "$group": {
                "_id": "$month",
                "total_enquiries": {"$sum": 1},
                "won": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}
                },
                "lost": {
                    "$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}
                },
                "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    historical_data = await db.leads.aggregate(pipeline).to_list(100)
    
    if len(historical_data) < 3:
        return {
            "success": False,
            "message": "Insufficient historical data for forecasting. Need at least 3 months of data.",
            "historical_data": historical_data
        }
    
    # Prepare data for GPT-4o
    data_summary = "\n".join([
        f"Month {d['_id']}: {d['total_enquiries']} enquiries, {d['won']} won, {d['lost']} lost, {d['total_kva']} total KVA"
        for d in historical_data
    ])
    
    # Generate forecast using GPT-4o
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"forecast_{current_user.user_id}_{datetime.now().timestamp()}",
            system_message="""You are an expert sales forecasting analyst. Based on historical lead data, 
            provide predictions for future months. Be specific with numbers and explain your reasoning. 
            Format your response as JSON with the following structure:
            {
                "predictions": [
                    {"month": "YYYY-MM", "predicted_enquiries": number, "predicted_closures": number, "confidence": "high/medium/low"}
                ],
                "summary": "Brief explanation of the forecast",
                "factors": ["Key factors considered"],
                "recommendations": ["Actionable recommendations"]
            }"""
        ).with_model("openai", "gpt-4o")
        
        filters_applied = []
        if state:
            filters_applied.append(f"State: {state}")
        if dealer:
            filters_applied.append(f"Dealer: {dealer}")
        if location:
            filters_applied.append(f"Location: {location}")
        
        # Get distribution data for detailed breakdown
        state_dist = await db.leads.aggregate([
            {"$match": query},
            {"$group": {"_id": "$state", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(50)
        
        dealer_dist = await db.leads.aggregate([
            {"$match": query},
            {"$group": {"_id": "$dealer", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(50)
        
        segment_dist = await db.leads.aggregate([
            {"$match": query},
            {"$group": {"_id": "$segment", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(50)
        
        employee_dist = await db.leads.aggregate([
            {"$match": query},
            {"$group": {"_id": "$employee_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]).to_list(50)
        
        total_leads = sum([d["count"] for d in state_dist])
        
        dist_summary = f"""
Distribution of {total_leads} total leads:
By State: {', '.join([f"{d['_id']}: {d['count']} ({round(d['count']/total_leads*100,1)}%)" for d in state_dist[:5] if d['_id']])}
By Segment: {', '.join([f"{d['_id']}: {d['count']} ({round(d['count']/total_leads*100,1)}%)" for d in segment_dist[:5] if d['_id']])}
Top Dealers: {', '.join([f"{d['_id']}: {d['count']}" for d in dealer_dist[:5] if d['_id']])}
Top Employees: {', '.join([f"{d['_id']}: {d['count']}" for d in employee_dist[:5] if d['_id']])}
"""
        
        prompt = f"""Based on the following historical lead data, generate a {horizon}-month forecast with DETAILED BREAKDOWN.
        
        Filters applied: {', '.join(filters_applied) if filters_applied else 'None (all data)'}
        
        Historical Data by Month:
        {data_summary}
        
        Current Distribution:
        {dist_summary}
        
        Please analyze trends and provide predictions for the next {horizon} months.
        
        IMPORTANT: For EACH predicted month, provide a detailed breakdown showing:
        - How many leads each STATE should expect
        - How many leads each top DEALER should expect  
        - How many leads each SEGMENT should expect
        - How many leads each top EMPLOYEE should expect
        
        Base the distribution on historical patterns but account for trends.
        
        Format your response as JSON:
        {{
            "predictions": [
                {{
                    "month": "YYYY-MM", 
                    "predicted_enquiries": number, 
                    "predicted_closures": number, 
                    "confidence": "high/medium/low",
                    "breakdown": {{
                        "by_state": [{{"name": "State Name", "predicted": number, "percentage": number}}],
                        "by_dealer": [{{"name": "Dealer Name", "predicted": number, "percentage": number}}],
                        "by_segment": [{{"name": "Segment Name", "predicted": number, "percentage": number}}],
                        "by_employee": [{{"name": "Employee Name", "predicted": number, "percentage": number}}]
                    }}
                }}
            ],
            "summary": "Brief explanation of the forecast",
            "factors": ["Key factors considered"],
            "recommendations": ["Actionable recommendations"]
        }}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Try to parse JSON from response
        import json
        try:
            # Extract JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                forecast_json = json.loads(response[json_start:json_end])
            else:
                forecast_json = {"raw_response": response}
        except json.JSONDecodeError:
            forecast_json = {"raw_response": response}
        
        return {
            "success": True,
            "forecast": forecast_json,
            "historical_data": historical_data,
            "horizon_months": horizon,
            "filters": {
                "state": state,
                "dealer": dealer,
                "location": location
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Forecast generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")
