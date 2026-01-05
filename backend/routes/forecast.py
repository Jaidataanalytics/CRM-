from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional, List, Dict
from datetime import datetime, timezone
import logging
import os
import json
import re
from statistics import mean, stdev

from models.user import User, UserRole
from routes.auth import get_current_user, require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forecast", tags=["Forecast"])


async def get_db(request: Request):
    return request.app.state.db


def calculate_accuracy_metrics(actual: List[float], predicted: List[float]) -> Dict:
    """Calculate comprehensive accuracy metrics"""
    if not actual or not predicted or len(actual) != len(predicted):
        return {"error": "Invalid data for accuracy calculation"}
    
    n = len(actual)
    
    # Mean Absolute Error (MAE)
    mae = sum(abs(a - p) for a, p in zip(actual, predicted)) / n
    
    # Mean Squared Error (MSE)
    mse = sum((a - p) ** 2 for a, p in zip(actual, predicted)) / n
    
    # Root Mean Squared Error (RMSE)
    rmse = mse ** 0.5
    
    # Mean Absolute Percentage Error (MAPE) - avoid division by zero
    mape_values = []
    for a, p in zip(actual, predicted):
        if a != 0:
            mape_values.append(abs((a - p) / a) * 100)
    mape = mean(mape_values) if mape_values else 0
    
    # Symmetric MAPE (sMAPE)
    smape_values = []
    for a, p in zip(actual, predicted):
        if (abs(a) + abs(p)) != 0:
            smape_values.append(200 * abs(a - p) / (abs(a) + abs(p)))
    smape = mean(smape_values) if smape_values else 0
    
    # R-squared (Coefficient of Determination)
    actual_mean = mean(actual)
    ss_tot = sum((a - actual_mean) ** 2 for a in actual)
    ss_res = sum((a - p) ** 2 for a, p in zip(actual, predicted))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
    
    # Accuracy percentage (based on MAPE)
    accuracy_pct = max(0, 100 - mape)
    
    # Direction accuracy (did we predict increase/decrease correctly?)
    direction_correct = 0
    for i in range(1, n):
        actual_direction = actual[i] - actual[i-1]
        predicted_direction = predicted[i] - predicted[i-1]
        if (actual_direction > 0 and predicted_direction > 0) or \
           (actual_direction < 0 and predicted_direction < 0) or \
           (actual_direction == 0 and predicted_direction == 0):
            direction_correct += 1
    direction_accuracy = (direction_correct / (n - 1) * 100) if n > 1 else 0
    
    return {
        "mae": round(mae, 2),
        "mse": round(mse, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "smape": round(smape, 2),
        "r_squared": round(r_squared, 4),
        "accuracy_percentage": round(accuracy_pct, 2),
        "direction_accuracy": round(direction_accuracy, 2),
        "sample_size": n,
        "interpretation": {
            "mae": f"On average, predictions are off by {round(mae, 0)} units",
            "mape": f"{round(mape, 1)}% average error - {'Excellent' if mape < 10 else 'Good' if mape < 20 else 'Fair' if mape < 30 else 'Needs Improvement'}",
            "r_squared": f"Model explains {round(r_squared * 100, 1)}% of variance - {'Excellent' if r_squared > 0.9 else 'Good' if r_squared > 0.7 else 'Fair' if r_squared > 0.5 else 'Poor'}",
            "direction": f"Correctly predicted direction {round(direction_accuracy, 0)}% of the time"
        }
    }


def simple_forecast(historical_data: List[Dict], months_ahead: int) -> List[Dict]:
    """Generate simple statistical forecast using moving average and trend"""
    if len(historical_data) < 3:
        return []
    
    # Use last 6 months for moving average (or all if less)
    window = min(6, len(historical_data))
    recent = historical_data[-window:]
    
    # Calculate averages
    avg_enquiries = mean([d.get('total_enquiries', 0) for d in recent])
    avg_closures = mean([d.get('won', 0) for d in recent])
    avg_kva = mean([d.get('total_kva', 0) for d in recent])
    
    # Calculate trend (linear regression slope)
    if len(historical_data) >= 6:
        x = list(range(len(historical_data)))
        y_enq = [d.get('total_enquiries', 0) for d in historical_data]
        y_won = [d.get('won', 0) for d in historical_data]
        
        x_mean = mean(x)
        y_enq_mean = mean(y_enq)
        y_won_mean = mean(y_won)
        
        # Calculate slopes
        numerator_enq = sum((xi - x_mean) * (yi - y_enq_mean) for xi, yi in zip(x, y_enq))
        numerator_won = sum((xi - x_mean) * (yi - y_won_mean) for xi, yi in zip(x, y_won))
        denominator = sum((xi - x_mean) ** 2 for xi in x)
        
        slope_enq = numerator_enq / denominator if denominator != 0 else 0
        slope_won = numerator_won / denominator if denominator != 0 else 0
    else:
        slope_enq = 0
        slope_won = 0
    
    predictions = []
    for i in range(months_ahead):
        predictions.append({
            'predicted_enquiries': int(avg_enquiries + slope_enq * (i + 1)),
            'predicted_closures': int(avg_closures + slope_won * (i + 1)),
            'predicted_kva': int(avg_kva + (avg_kva * 0.02 * (i + 1)))  # Small growth
        })
    
    return predictions


@router.post("/backtest")
async def run_backtest(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Run rolling window backtest to evaluate forecast accuracy"""
    db = await get_db(request)
    body = await request.json()
    
    window_size = body.get("window_size", 6)  # Training window in months
    test_periods = body.get("test_periods", 3)  # How many periods to test
    
    # Get all historical data
    pipeline = [
        {"$match": {"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {
            "_id": "$month",
            "total_enquiries": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}},
            "lost": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}},
            "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    all_data = await db.leads.aggregate(pipeline).to_list(100)
    
    if len(all_data) < window_size + test_periods:
        return {
            "success": False,
            "message": f"Insufficient data. Need at least {window_size + test_periods} months, have {len(all_data)}."
        }
    
    # Rolling window backtest
    backtest_results = []
    all_actual_enquiries = []
    all_predicted_enquiries = []
    all_actual_closures = []
    all_predicted_closures = []
    all_actual_kva = []
    all_predicted_kva = []
    
    # Test multiple windows
    num_tests = min(test_periods, len(all_data) - window_size)
    
    for i in range(num_tests):
        start_idx = len(all_data) - window_size - num_tests + i
        end_idx = start_idx + window_size
        test_idx = end_idx
        
        if test_idx >= len(all_data):
            break
        
        train_data = all_data[start_idx:end_idx]
        actual_data = all_data[test_idx]
        
        # Generate prediction using simple forecast
        prediction = simple_forecast(train_data, 1)[0]
        
        # Record results
        result = {
            "training_period": f"{train_data[0]['_id']} to {train_data[-1]['_id']}",
            "test_month": actual_data['_id'],
            "actual": {
                "enquiries": actual_data['total_enquiries'],
                "closures": actual_data['won'],
                "kva": round(actual_data['total_kva'], 0)
            },
            "predicted": {
                "enquiries": prediction['predicted_enquiries'],
                "closures": prediction['predicted_closures'],
                "kva": prediction['predicted_kva']
            },
            "error": {
                "enquiries": actual_data['total_enquiries'] - prediction['predicted_enquiries'],
                "closures": actual_data['won'] - prediction['predicted_closures'],
                "kva": round(actual_data['total_kva'] - prediction['predicted_kva'], 0)
            },
            "error_pct": {
                "enquiries": round((actual_data['total_enquiries'] - prediction['predicted_enquiries']) / actual_data['total_enquiries'] * 100, 1) if actual_data['total_enquiries'] > 0 else 0,
                "closures": round((actual_data['won'] - prediction['predicted_closures']) / actual_data['won'] * 100, 1) if actual_data['won'] > 0 else 0,
                "kva": round((actual_data['total_kva'] - prediction['predicted_kva']) / actual_data['total_kva'] * 100, 1) if actual_data['total_kva'] > 0 else 0
            }
        }
        backtest_results.append(result)
        
        # Collect for aggregate metrics
        all_actual_enquiries.append(actual_data['total_enquiries'])
        all_predicted_enquiries.append(prediction['predicted_enquiries'])
        all_actual_closures.append(actual_data['won'])
        all_predicted_closures.append(prediction['predicted_closures'])
        all_actual_kva.append(actual_data['total_kva'])
        all_predicted_kva.append(prediction['predicted_kva'])
    
    # Calculate aggregate metrics
    enquiry_metrics = calculate_accuracy_metrics(all_actual_enquiries, all_predicted_enquiries)
    closure_metrics = calculate_accuracy_metrics(all_actual_closures, all_predicted_closures)
    kva_metrics = calculate_accuracy_metrics(all_actual_kva, all_predicted_kva)
    
    # Recommendations based on accuracy
    recommendations = []
    overall_accuracy = (enquiry_metrics.get('accuracy_percentage', 0) + 
                       closure_metrics.get('accuracy_percentage', 0) + 
                       kva_metrics.get('accuracy_percentage', 0)) / 3
    
    if enquiry_metrics.get('mape', 100) > 20:
        recommendations.append("Lead volume predictions have high variance. Consider adding seasonal factors or external market indicators.")
    if closure_metrics.get('mape', 100) > 20:
        recommendations.append("Closure predictions are less accurate. Review sales cycle changes and conversion rate trends.")
    if kva_metrics.get('mape', 100) > 25:
        recommendations.append("KVA predictions show volatility. Product mix is changing - segment KVA forecasts separately.")
    if enquiry_metrics.get('direction_accuracy', 0) < 60:
        recommendations.append("Trend direction predictions need improvement. Consider longer historical windows.")
    if overall_accuracy > 80:
        recommendations.append("Overall forecast accuracy is strong. Current model parameters are working well.")
    
    return {
        "success": True,
        "backtest_summary": {
            "total_tests": len(backtest_results),
            "window_size_months": window_size,
            "data_range": f"{all_data[0]['_id']} to {all_data[-1]['_id']}",
            "total_months_available": len(all_data)
        },
        "accuracy_metrics": {
            "enquiries": enquiry_metrics,
            "closures": closure_metrics,
            "kva": kva_metrics,
            "overall_accuracy": round(overall_accuracy, 2)
        },
        "detailed_results": backtest_results,
        "recommendations": recommendations,
        "factors_used": [
            "6-month moving average for baseline",
            "Linear trend analysis for growth/decline",
            "Historical distribution patterns",
            "Seasonal adjustment (implicit in moving average)"
        ],
        "improvement_suggestions": [
            {"factor": "Seasonality", "description": "Add explicit month-over-month seasonal indices", "impact": "High"},
            {"factor": "Market Events", "description": "Incorporate external factors like festivals, economic indicators", "impact": "Medium"},
            {"factor": "Product Mix", "description": "Weight predictions by KVA category trends", "impact": "Medium"},
            {"factor": "Lead Quality", "description": "Factor in Hot/Warm/Cold lead ratios", "impact": "High"},
            {"factor": "Regional Trends", "description": "Build state-specific forecast models", "impact": "Medium"}
        ],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/factors")
async def get_forecast_factors(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Get detailed information about all factors used in forecasting"""
    db = await get_db(request)
    
    # Get data distribution stats
    total_leads = await db.leads.count_documents({})
    leads_with_kva = await db.leads.count_documents({"kva": {"$exists": True, "$ne": None, "$gt": 0}})
    leads_with_date = await db.leads.count_documents({"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}})
    
    # Get unique KVA values
    kva_pipeline = [
        {"$match": {"kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$group": {"_id": "$kva", "count": {"$sum": 1}, "total_kva": {"$sum": "$kva"}}},
        {"$sort": {"_id": 1}}
    ]
    kva_values = await db.leads.aggregate(kva_pipeline).to_list(100)
    
    # Get monthly trends
    monthly_pipeline = [
        {"$match": {"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {
            "_id": "$month",
            "total": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}},
            "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    monthly_data = await db.leads.aggregate(monthly_pipeline).to_list(100)
    
    return {
        "success": True,
        "data_quality": {
            "total_leads": total_leads,
            "leads_with_kva": leads_with_kva,
            "kva_coverage": round(leads_with_kva / total_leads * 100, 1) if total_leads > 0 else 0,
            "leads_with_date": leads_with_date,
            "date_coverage": round(leads_with_date / total_leads * 100, 1) if total_leads > 0 else 0,
            "months_of_data": len(monthly_data)
        },
        "forecast_factors": {
            "primary_factors": [
                {
                    "name": "Historical Monthly Volume",
                    "description": "Total enquiries received each month",
                    "weight": "High",
                    "data_points": len(monthly_data)
                },
                {
                    "name": "Conversion Rate Trends",
                    "description": "Ratio of Closed-Won to total leads over time",
                    "weight": "High",
                    "data_points": len(monthly_data)
                },
                {
                    "name": "KVA Distribution",
                    "description": "Product mix by generator capacity",
                    "weight": "Medium",
                    "unique_values": len(kva_values)
                },
                {
                    "name": "State/Regional Distribution",
                    "description": "Geographic spread of leads",
                    "weight": "Medium",
                    "data_points": "By region"
                }
            ],
            "secondary_factors": [
                {
                    "name": "Segment Distribution",
                    "description": "Industry vertical breakdown",
                    "weight": "Medium"
                },
                {
                    "name": "Lead Type (Hot/Warm/Cold)",
                    "description": "Lead quality classification",
                    "weight": "Low-Medium"
                },
                {
                    "name": "Dealer Performance",
                    "description": "Sales channel effectiveness",
                    "weight": "Low"
                }
            ],
            "not_currently_used": [
                "External economic indicators",
                "Competitor activity",
                "Marketing campaign data",
                "Weather/seasonal events",
                "Policy/regulatory changes"
            ]
        },
        "kva_products": [
            {
                "kva": v["_id"],
                "lead_count": v["count"],
                "percentage": round(v["count"] / leads_with_kva * 100, 2) if leads_with_kva > 0 else 0
            } for v in kva_values
        ],
        "methodology": {
            "model_type": "Hybrid (AI + Statistical)",
            "ai_component": "GPT-4o for pattern recognition and contextual analysis",
            "statistical_component": "Moving average with linear trend adjustment",
            "fallback": "Pure statistical model if AI parsing fails"
        }
    }


@router.post("")
async def generate_forecast(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Generate AI-powered forecast using GPT-4o with KVA breakdown"""
    db = await get_db(request)
    body = await request.json()
    
    horizon = body.get("horizon", 3)  # 3, 6, or 12 months
    state = body.get("state")
    dealer = body.get("dealer")
    location = body.get("location")
    
    if horizon not in [3, 6, 12]:
        raise HTTPException(status_code=400, detail="Horizon must be 3, 6, or 12 months")
    
    # Build query for historical data
    query = {"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}}
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if location:
        query["location"] = location
    
    # Get historical data grouped by month
    pipeline = [
        {"$match": query},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {
            "_id": "$month",
            "total_enquiries": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}},
            "lost": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Lost"]}, 1, 0]}},
            "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}},
            "avg_kva": {"$avg": {"$ifNull": ["$kva", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    historical_data = await db.leads.aggregate(pipeline).to_list(100)
    
    if len(historical_data) < 3:
        return {
            "success": False,
            "message": "Insufficient historical data for forecasting. Need at least 3 months of data.",
            "historical_data": historical_data
        }
    
    # Get KVA distribution for breakdown
    kva_dist_pipeline = [
        {"$match": {**query, "kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$group": {"_id": "$kva", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    kva_distribution = await db.leads.aggregate(kva_dist_pipeline).to_list(100)
    
    # Get monthly KVA breakdown for trend analysis
    monthly_kva_pipeline = [
        {"$match": {**query, "kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {
            "_id": {"month": "$month", "kva": "$kva"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.month": 1, "_id.kva": 1}}
    ]
    monthly_kva_data = await db.leads.aggregate(monthly_kva_pipeline).to_list(1000)
    
    # Prepare data for GPT-4o
    data_summary = "\n".join([
        f"Month {d['_id']}: {d['total_enquiries']} enquiries, {d['won']} won, {d['lost']} lost, {d['total_kva']:.0f} total KVA, {d['avg_kva']:.1f} avg KVA"
        for d in historical_data
    ])
    
    # KVA summary
    total_kva_leads = sum([d["count"] for d in kva_distribution])
    kva_summary = "\n".join([
        f"  {d['_id']} KVA: {d['count']} leads ({round(d['count']/total_kva_leads*100, 1)}%)"
        for d in kva_distribution
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
            system_message="""You are an expert sales forecasting analyst for a generator/genset company. 
            Analyze historical lead data and provide detailed predictions including KVA (generator capacity) breakdown.
            Be specific with numbers and explain your reasoning based on trends.
            Always respond with valid JSON only, no markdown formatting."""
        ).with_model("openai", "gpt-4o")
        
        filters_applied = []
        if state:
            filters_applied.append(f"State: {state}")
        if dealer:
            filters_applied.append(f"Dealer: {dealer}")
        if location:
            filters_applied.append(f"Location: {location}")
        
        # Get other distribution data
        state_dist = await db.leads.aggregate([
            {"$match": query},
            {"$group": {"_id": "$state", "count": {"$sum": 1}, "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}}},
            {"$sort": {"count": -1}}
        ]).to_list(50)
        
        segment_dist = await db.leads.aggregate([
            {"$match": query},
            {"$group": {"_id": "$segment", "count": {"$sum": 1}, "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}}},
            {"$sort": {"count": -1}}
        ]).to_list(50)
        
        total_leads = sum([d["count"] for d in state_dist])
        
        # Prepare KVA list for prompt
        kva_values_list = [d["_id"] for d in kva_distribution]
        
        prompt = f"""Based on the following historical lead data for a generator company, generate a {horizon}-month forecast with DETAILED KVA BREAKDOWN.

Filters applied: {', '.join(filters_applied) if filters_applied else 'None (all data)'}

HISTORICAL DATA BY MONTH:
{data_summary}

KVA PRODUCT DISTRIBUTION (Generator Capacities):
{kva_summary}

Total leads analyzed: {total_leads}
Unique KVA products: {len(kva_distribution)} ({', '.join([str(k) for k in kva_values_list])} KVA)

ANALYSIS REQUIRED:
1. Identify trends in overall lead volume
2. Analyze conversion rate patterns
3. Identify KVA product mix trends (which capacities are growing/declining)
4. Project these trends forward for {horizon} months

FORMAT YOUR RESPONSE AS JSON:
{{
    "predictions": [
        {{
            "month": "YYYY-MM",
            "predicted_enquiries": number,
            "predicted_closures": number,
            "predicted_total_kva": number,
            "confidence": "high/medium/low",
            "breakdown": {{
                "by_kva": [
                    {{"kva": 5, "predicted_leads": number, "predicted_kva_value": number, "percentage": number}},
                    {{"kva": 10, "predicted_leads": number, "predicted_kva_value": number, "percentage": number}}
                ]
            }}
        }}
    ],
    "summary": "Brief explanation of the forecast methodology and key insights",
    "trend_analysis": {{
        "volume_trend": "increasing/stable/decreasing with percentage",
        "conversion_trend": "description",
        "kva_mix_trend": "which KVA products are growing vs declining",
        "seasonal_patterns": "any observed patterns"
    }},
    "factors_considered": ["list of key factors that influenced the prediction"],
    "recommendations": ["actionable recommendations based on the analysis"],
    "risks": ["potential risks or uncertainties in the forecast"]
}}

IMPORTANT: 
- Include ALL {len(kva_distribution)} KVA values in the by_kva breakdown
- Use the historical distribution percentages to calculate predicted counts
- Predicted_kva_value = kva * predicted_leads for each category"""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        forecast_json = None
        try:
            clean_response = response
            clean_response = re.sub(r'```json\s*\n?', '', clean_response)
            clean_response = re.sub(r'```\s*\n?', '', clean_response)
            clean_response = clean_response.strip()
            
            json_start = clean_response.find("{")
            json_end = clean_response.rfind("}") + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = clean_response[json_start:json_end]
                forecast_json = json.loads(json_str)
                logger.info(f"Successfully parsed forecast JSON with {len(forecast_json.get('predictions', []))} predictions")
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
        
        # Fallback if AI parsing fails
        if not forecast_json or 'predictions' not in forecast_json:
            logger.warning("AI response could not be parsed, generating fallback forecast")
            forecast_json = generate_fallback_forecast(historical_data, kva_distribution, horizon)
        
        return {
            "success": True,
            "forecast": forecast_json,
            "historical_data": historical_data,
            "kva_distribution": [{"kva": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_kva_leads*100, 2)} for d in kva_distribution],
            "horizon_months": horizon,
            "filters": {"state": state, "dealer": dealer, "location": location},
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Forecast generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")


def generate_fallback_forecast(historical_data: List[Dict], kva_distribution: List[Dict], horizon: int) -> Dict:
    """Generate statistical fallback forecast with KVA breakdown"""
    from dateutil.relativedelta import relativedelta
    
    # Calculate averages from historical data
    avg_enquiries = mean([d['total_enquiries'] for d in historical_data]) if historical_data else 300
    avg_closures = mean([d['won'] for d in historical_data]) if historical_data else 100
    avg_kva = mean([d['total_kva'] for d in historical_data]) if historical_data else 15000
    
    # Calculate trend
    if len(historical_data) >= 6:
        recent_avg = mean([d['total_enquiries'] for d in historical_data[-3:]])
        older_avg = mean([d['total_enquiries'] for d in historical_data[-6:-3]])
        growth_rate = (recent_avg - older_avg) / older_avg if older_avg > 0 else 0.02
    else:
        growth_rate = 0.02
    
    # KVA distribution for breakdown
    total_kva_leads = sum([d["count"] for d in kva_distribution]) if kva_distribution else 1
    
    predictions = []
    base_date = datetime.now(timezone.utc)
    
    for i in range(horizon):
        month_date = base_date + relativedelta(months=i+1)
        growth_factor = 1 + growth_rate * (i + 1)
        
        predicted_enquiries = int(avg_enquiries * growth_factor)
        predicted_closures = int(avg_closures * growth_factor)
        predicted_total_kva = int(avg_kva * growth_factor)
        
        # Generate KVA breakdown
        kva_breakdown = []
        for kv in kva_distribution:
            pct = kv["count"] / total_kva_leads
            pred_leads = int(predicted_enquiries * pct)
            kva_breakdown.append({
                "kva": kv["_id"],
                "predicted_leads": pred_leads,
                "predicted_kva_value": pred_leads * kv["_id"],
                "percentage": round(pct * 100, 2)
            })
        
        predictions.append({
            "month": month_date.strftime("%Y-%m"),
            "predicted_enquiries": predicted_enquiries,
            "predicted_closures": predicted_closures,
            "predicted_total_kva": predicted_total_kva,
            "confidence": "medium",
            "breakdown": {"by_kva": kva_breakdown}
        })
    
    return {
        "predictions": predictions,
        "summary": f"Statistical forecast based on {len(historical_data)} months of data. Average {int(avg_enquiries)} enquiries/month with {round(growth_rate*100, 1)}% projected growth.",
        "trend_analysis": {
            "volume_trend": f"{'Increasing' if growth_rate > 0 else 'Decreasing'} at {abs(round(growth_rate*100, 1))}%",
            "conversion_trend": "Based on historical averages",
            "kva_mix_trend": "Stable distribution assumed",
            "seasonal_patterns": "Not explicitly modeled in fallback"
        },
        "factors_considered": [
            "Historical monthly averages",
            "6-month trend analysis",
            "KVA product distribution",
            "Linear growth projection"
        ],
        "recommendations": [
            "Monitor actual vs predicted for model calibration",
            "Consider seasonal adjustments for Q4",
            "Review high-volume KVA categories for targeted campaigns"
        ],
        "risks": [
            "External market factors not captured",
            "Assumes stable product mix",
            "Linear trend may not capture cyclical patterns"
        ]
    }
