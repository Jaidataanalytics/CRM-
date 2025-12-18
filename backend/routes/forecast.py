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
        
        # Prepare complete distribution data for breakdown
        state_list = [{"name": d["_id"], "count": d["count"], "pct": round(d["count"]/total_leads*100, 1)} for d in state_dist if d["_id"]]
        dealer_list = [{"name": d["_id"], "count": d["count"], "pct": round(d["count"]/total_leads*100, 1)} for d in dealer_dist if d["_id"]]
        segment_list = [{"name": d["_id"], "count": d["count"], "pct": round(d["count"]/total_leads*100, 1)} for d in segment_dist if d["_id"]]
        employee_list = [{"name": d["_id"], "count": d["count"], "pct": round(d["count"]/total_leads*100, 1)} for d in employee_dist if d["_id"]]
        
        dist_summary = f"""
Distribution of {total_leads} total leads:
By State ({len(state_list)} states): {', '.join([f"{d['name']}: {d['count']} ({d['pct']}%)" for d in state_list])}
By Segment ({len(segment_list)} segments): {', '.join([f"{d['name']}: {d['count']} ({d['pct']}%)" for d in segment_list])}
By Dealer ({len(dealer_list)} dealers): {', '.join([f"{d['name']}: {d['count']}" for d in dealer_list[:10]])}... and {len(dealer_list)-10} more
By Employee ({len(employee_list)} employees): {', '.join([f"{d['name']}: {d['count']}" for d in employee_list[:10]])}... and {len(employee_list)-10} more
"""
        
        prompt = f"""Based on the following historical lead data, generate a {horizon}-month forecast with DETAILED BREAKDOWN.
        
        Filters applied: {', '.join(filters_applied) if filters_applied else 'None (all data)'}
        
        Historical Data by Month:
        {data_summary}
        
        Current Distribution:
        {dist_summary}
        
        Please analyze trends and provide predictions for the next {horizon} months.
        
        IMPORTANT: For EACH predicted month, provide a COMPLETE detailed breakdown showing:
        - How many leads EACH STATE should expect (ALL {len(state_list)} states)
        - How many leads EACH DEALER should expect (ALL {len(dealer_list)} dealers)
        - How many leads EACH SEGMENT should expect (ALL {len(segment_list)} segments)
        - How many leads EACH EMPLOYEE should expect (ALL {len(employee_list)} employees)
        
        Use the historical distribution percentages to calculate predicted counts for each entity.
        
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
        }}
        
        IMPORTANT: Include ALL entities from the distribution data, not just top 5."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Try to parse JSON from response
        import json
        import re
        
        forecast_json = None
        try:
            # Remove markdown code blocks if present
            clean_response = response
            
            # More robust markdown removal
            clean_response = re.sub(r'```json\s*\n?', '', clean_response)
            clean_response = re.sub(r'```\s*\n?', '', clean_response)
            
            # Remove any comments (// style) from JSON - but be careful with URLs
            clean_response = re.sub(r'(?<!:)//[^\n]*', '', clean_response)
            
            # Strip whitespace
            clean_response = clean_response.strip()
            
            # Extract JSON from response
            json_start = clean_response.find("{")
            json_end = clean_response.rfind("}") + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = clean_response[json_start:json_end]
                forecast_json = json.loads(json_str)
                logger.info(f"Successfully parsed forecast JSON with {len(forecast_json.get('predictions', []))} predictions")
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Clean response snippet: {clean_response[:500] if clean_response else 'EMPTY'}")
        
        # If parsing failed, create a simplified forecast from historical data
        if not forecast_json or 'predictions' not in forecast_json:
            logger.warning("AI response could not be parsed, generating fallback forecast")
            avg_enquiries = sum([d['total_enquiries'] for d in historical_data]) // len(historical_data) if historical_data else 300
            avg_closures = sum([d['won'] for d in historical_data]) // len(historical_data) if historical_data else 150
            
            # Generate predictions for each month
            from datetime import datetime
            predictions = []
            base_date = datetime.now()
            for i in range(horizon):
                month_date = datetime(base_date.year, base_date.month + i + 1 if base_date.month + i < 12 else (base_date.month + i) % 12 + 1, 1)
                if base_date.month + i >= 12:
                    month_date = datetime(base_date.year + 1, (base_date.month + i) % 12 + 1, 1)
                predictions.append({
                    "month": month_date.strftime("%Y-%m"),
                    "predicted_enquiries": int(avg_enquiries * (1 + 0.05 * i)),
                    "predicted_closures": int(avg_closures * (1 + 0.03 * i)),
                    "confidence": "medium",
                    "breakdown": {
                        "by_state": [{"name": d["_id"], "predicted": int(d["count"] * (1 + 0.05 * i)), "percentage": d.get("pct", 0)} for d in state_dist[:10] if d["_id"]],
                        "by_dealer": [{"name": d["_id"], "predicted": int(d["count"] * (1 + 0.05 * i)), "percentage": d.get("pct", 0)} for d in dealer_dist[:10] if d["_id"]],
                        "by_segment": [{"name": d["_id"], "predicted": int(d["count"] * (1 + 0.05 * i)), "percentage": d.get("pct", 0)} for d in segment_dist[:10] if d["_id"]],
                        "by_employee": [{"name": d["_id"], "predicted": int(d["count"] * (1 + 0.05 * i)), "percentage": d.get("pct", 0)} for d in employee_dist[:10] if d["_id"]]
                    }
                })
            
            forecast_json = {
                "predictions": predictions,
                "summary": f"Forecast based on historical average of {avg_enquiries} enquiries and {avg_closures} closures per month. AI response processing had issues - using statistical fallback.",
                "factors": ["Historical monthly averages", "Seasonal trends", "Current distribution patterns"],
                "recommendations": ["Monitor actual performance against forecast", "Adjust strategies based on market conditions"]
            }
        
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
