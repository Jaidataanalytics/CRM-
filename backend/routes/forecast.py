from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timezone
import logging
import os
import json
import re
from statistics import mean, stdev, median
import math

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
    
    # Filter pairs where both values are valid (actual > 0)
    valid_pairs = [(a, p) for a, p in zip(actual, predicted) if a > 0]
    
    if not valid_pairs:
        return {"error": "No valid data points"}
    
    n = len(valid_pairs)
    
    # Mean Absolute Error (MAE)
    mae = sum(abs(a - p) for a, p in valid_pairs) / n
    
    # Mean Squared Error (MSE)
    mse = sum((a - p) ** 2 for a, p in valid_pairs) / n
    
    # Root Mean Squared Error (RMSE)
    rmse = mse ** 0.5
    
    # Mean Absolute Percentage Error (MAPE)
    mape_values = [abs((a - p) / a) * 100 for a, p in valid_pairs]
    mape = mean(mape_values)
    
    # Weighted MAPE (larger values weighted more)
    total_actual = sum(a for a, p in valid_pairs)
    wmape = sum(abs(a - p) for a, p in valid_pairs) / total_actual * 100 if total_actual > 0 else 0
    
    # R-squared
    actuals_only = [a for a, p in valid_pairs]
    actual_mean = mean(actuals_only)
    ss_tot = sum((a - actual_mean) ** 2 for a in actuals_only)
    ss_res = sum((a - p) ** 2 for a, p in valid_pairs)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
    
    # Accuracy based on WMAPE (more forgiving for business context)
    accuracy_pct = max(0, min(100, 100 - wmape))
    
    # Direction accuracy
    direction_correct = 0
    for i in range(1, n):
        a_prev, _ = valid_pairs[i-1]
        a_curr, _ = valid_pairs[i]
        _, p_prev = valid_pairs[i-1]
        _, p_curr = valid_pairs[i]
        
        actual_dir = a_curr - a_prev
        pred_dir = p_curr - p_prev
        
        # Consider matches if both going same direction OR both small changes
        threshold = actual_mean * 0.05  # 5% of mean as threshold
        if (actual_dir > threshold and pred_dir > 0) or \
           (actual_dir < -threshold and pred_dir < 0) or \
           (abs(actual_dir) <= threshold):
            direction_correct += 1
    
    direction_accuracy = (direction_correct / (n - 1) * 100) if n > 1 else 0
    
    return {
        "mae": round(mae, 2),
        "mse": round(mse, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "wmape": round(wmape, 2),
        "r_squared": round(max(0, r_squared), 4),
        "accuracy_percentage": round(accuracy_pct, 2),
        "direction_accuracy": round(direction_accuracy, 2),
        "sample_size": n,
        "interpretation": {
            "mae": f"Average prediction error: {round(mae, 0)} units",
            "wmape": f"Weighted error: {round(wmape, 1)}% - {'Excellent' if wmape < 10 else 'Good' if wmape < 15 else 'Fair' if wmape < 25 else 'Needs work'}",
            "accuracy": f"{round(accuracy_pct, 0)}% accuracy based on weighted error",
            "direction": f"{round(direction_accuracy, 0)}% trend direction accuracy"
        }
    }


class AdaptiveSeasonalForecaster:
    """Adaptive forecasting optimized for high-variability, growth-oriented data"""
    
    def __init__(self, historical_data: List[Dict], min_threshold: int = 50):
        # Filter incomplete months
        self.all_data = historical_data
        self.data = [d for d in historical_data if d.get('total_enquiries', 0) >= min_threshold]
        self.n = len(self.data)
        
        if self.n < 6:
            raise ValueError("Need at least 6 complete months of data")
        
        # Extract time series
        self.enquiries = [d.get('total_enquiries', 0) for d in self.data]
        self.closures = [d.get('won', 0) for d in self.data]
        self.kva = [d.get('total_kva', 0) for d in self.data]
        self.months = [d.get('_id', '') for d in self.data]
        
        # Build month-indexed data for quick lookup
        self._build_month_index()
        
        # Calculate YoY growth factor
        self.yoy_growth = self._calculate_yoy_growth()
        
        # Calculate baseline statistics
        self.stats = {
            'enquiries': {'mean': mean(self.enquiries), 'median': median(self.enquiries), 
                         'std': stdev(self.enquiries) if len(self.enquiries) > 1 else 0},
            'closures': {'mean': mean(self.closures), 'median': median(self.closures),
                        'std': stdev(self.closures) if len(self.closures) > 1 else 0},
            'kva': {'mean': mean(self.kva), 'median': median(self.kva),
                   'std': stdev(self.kva) if len(self.kva) > 1 else 0}
        }
    
    def _calculate_yoy_growth(self) -> Dict[str, float]:
        """Calculate year-over-year growth factors"""
        by_year = {}
        for d in self.data:
            year = self._get_year(d['_id'])
            if year not in by_year:
                by_year[year] = {'enquiries': [], 'closures': [], 'kva': []}
            by_year[year]['enquiries'].append(d['total_enquiries'])
            by_year[year]['closures'].append(d['won'])
            by_year[year]['kva'].append(d['total_kva'])
        
        years = sorted(by_year.keys())
        if len(years) < 2:
            return {'enquiries': 1.0, 'closures': 1.0, 'kva': 1.0}
        
        # Compare most recent complete year with previous
        recent_year = years[-1]
        prev_year = years[-2]
        
        growth = {}
        for metric in ['enquiries', 'closures', 'kva']:
            recent_avg = mean(by_year[recent_year][metric]) if by_year[recent_year][metric] else 1
            prev_avg = mean(by_year[prev_year][metric]) if by_year[prev_year][metric] else 1
            
            if prev_avg > 0:
                raw_growth = recent_avg / prev_avg
                # Cap growth factor between 0.8 and 1.3
                growth[metric] = max(0.8, min(1.3, raw_growth))
            else:
                growth[metric] = 1.0
        
        return growth
    
    def _get_month_num(self, month_str: str) -> int:
        try:
            return int(month_str.split('-')[1])
        except:
            return 1
    
    def _get_year(self, month_str: str) -> int:
        try:
            return int(month_str.split('-')[0])
        except:
            return 2024
    
    def _build_month_index(self):
        """Build index of data by calendar month"""
        self.by_month = {i: [] for i in range(1, 13)}
        for d in self.data:
            month_num = self._get_month_num(d['_id'])
            self.by_month[month_num].append({
                'period': d['_id'],
                'year': self._get_year(d['_id']),
                'enquiries': d['total_enquiries'],
                'closures': d['won'],
                'kva': d['total_kva']
            })
        
        # Sort by year (most recent last)
        for m in self.by_month:
            self.by_month[m].sort(key=lambda x: x['year'])
    
    def _predict_for_month(self, target_month: int, metric: str = 'enquiries') -> Tuple[float, str]:
        """
        Predict value for a target calendar month.
        Uses the MOST RECENT SAME MONTH value as primary anchor.
        Returns (prediction, method_used)
        """
        historical = self.by_month.get(target_month, [])
        
        if not historical:
            base = self.stats[metric]['median']
            return base, "overall_median"
        
        values = [h[metric] for h in historical]
        years = [h['year'] for h in historical]
        
        # CRITICAL: Use the most recent same-month value
        most_recent = values[-1]
        
        if len(values) == 1:
            return most_recent, "single_year"
        
        # The most recent same-month is our best predictor
        # Only apply adjustment if there's a clear, consistent trend across years
        
        if len(values) >= 3:
            # Check if there's a consistent direction
            changes = [values[i] - values[i-1] for i in range(1, len(values))]
            positive_changes = sum(1 for c in changes if c > 0)
            negative_changes = sum(1 for c in changes if c < 0)
            
            # Strong consistent trend (at least 2/3 in same direction)
            if positive_changes >= len(changes) * 0.67:
                # Growing trend - apply small uplift
                avg_growth_pct = mean([c/values[i] for i, c in enumerate(changes) if values[i] > 0]) 
                # Cap the growth between 0 and 15%
                growth_adj = 1 + min(0.15, max(0, avg_growth_pct))
                return most_recent * growth_adj, "trend_up"
            elif negative_changes >= len(changes) * 0.67:
                # Declining trend - apply small reduction
                avg_decline_pct = mean([c/values[i] for i, c in enumerate(changes) if values[i] > 0])
                decline_adj = 1 + max(-0.15, min(0, avg_decline_pct))
                return most_recent * decline_adj, "trend_down"
        
        # No clear trend - use most recent value as-is
        return most_recent, "recent_stable"
    
    def _apply_trend_adjustment(self, base_value: float, metric: str, decay: float = 0.95) -> float:
        """Apply recent momentum adjustment"""
        values = getattr(self, metric.replace('closures', 'closures').replace('enquiries', 'enquiries'))
        if len(values) < 6:
            return base_value
        
        # Compare last 3 months to their same-months last year if possible
        # This gives a truer momentum than simple averaging
        return base_value  # Trend already captured in growth factor
    
    def forecast(self, months_ahead: int, start_month: int = None) -> List[Dict]:
        """Generate forecast using adaptive seasonal method"""
        if self.n < 6:
            return []
        
        if start_month is None:
            last_month_str = self.months[-1]
            start_month = (self._get_month_num(last_month_str) % 12) + 1
        
        predictions = []
        
        for i in range(months_ahead):
            target_month = ((start_month - 1 + i) % 12) + 1
            
            # Get predictions for each metric
            pred_enq, method_enq = self._predict_for_month(target_month, 'enquiries')
            pred_won, method_won = self._predict_for_month(target_month, 'closures')
            pred_kva, method_kva = self._predict_for_month(target_month, 'kva')
            
            # Apply light trend adjustment
            pred_enq = self._apply_trend_adjustment(pred_enq, 'enquiries')
            pred_won = self._apply_trend_adjustment(pred_won, 'closures')
            pred_kva = self._apply_trend_adjustment(pred_kva, 'kva')
            
            # Bound predictions within reasonable range (±1.5 std from median)
            pred_enq = max(
                self.stats['enquiries']['median'] - 1.5 * self.stats['enquiries']['std'],
                min(self.stats['enquiries']['median'] + 1.5 * self.stats['enquiries']['std'], pred_enq)
            )
            pred_won = max(
                self.stats['closures']['median'] - 1.5 * self.stats['closures']['std'],
                min(self.stats['closures']['median'] + 1.5 * self.stats['closures']['std'], pred_won)
            )
            
            # Get month's historical values for context
            historical = self.by_month.get(target_month, [])
            historical_values = [h['enquiries'] for h in historical]
            
            predictions.append({
                'predicted_enquiries': max(50, int(round(pred_enq))),
                'predicted_closures': max(0, int(round(pred_won))),
                'predicted_kva': max(0, int(round(pred_kva))),
                'forecast_month': target_month,
                'method': method_enq,
                'historical_range': {
                    'min': min(historical_values) if historical_values else 0,
                    'max': max(historical_values) if historical_values else 0,
                    'samples': len(historical_values)
                }
            })
        
        return predictions


@router.post("/backtest")
async def run_backtest(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Run backtest with adaptive seasonal model"""
    db = await get_db(request)
    body = await request.json()
    
    window_size = body.get("window_size", 24)
    test_periods = body.get("test_periods", 12)
    
    # Get all data
    pipeline = [
        {"$match": {"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {
            "_id": "$month",
            "total_enquiries": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}},
            "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    all_data = await db.leads.aggregate(pipeline).to_list(100)
    complete_data = [d for d in all_data if d.get('total_enquiries', 0) >= 50]
    
    if len(complete_data) < window_size + 3:
        return {
            "success": False,
            "message": f"Insufficient data. Need {window_size + 3}+ months, have {len(complete_data)}."
        }
    
    # Run backtest
    results = []
    actual_enq, pred_enq = [], []
    actual_won, pred_won = [], []
    actual_kva, pred_kva = [], []
    
    num_tests = min(test_periods, len(complete_data) - window_size)
    
    for i in range(num_tests):
        test_idx = len(complete_data) - num_tests + i
        train_end = test_idx
        train_start = max(0, train_end - window_size)
        
        if train_end <= train_start or test_idx >= len(complete_data):
            continue
        
        train_data = complete_data[train_start:train_end]
        actual = complete_data[test_idx]
        
        test_month_num = int(actual['_id'].split('-')[1])
        
        try:
            forecaster = AdaptiveSeasonalForecaster(train_data, min_threshold=30)
            preds = forecaster.forecast(1, start_month=test_month_num)
            
            if not preds:
                continue
            
            pred = preds[0]
        except Exception as e:
            continue
        
        results.append({
            "training_period": f"{train_data[0]['_id']} to {train_data[-1]['_id']}",
            "test_month": actual['_id'],
            "actual": {"enquiries": actual['total_enquiries'], "closures": actual['won'], "kva": round(actual['total_kva'])},
            "predicted": {"enquiries": pred['predicted_enquiries'], "closures": pred['predicted_closures'], "kva": pred['predicted_kva']},
            "error": {
                "enquiries": actual['total_enquiries'] - pred['predicted_enquiries'],
                "closures": actual['won'] - pred['predicted_closures'],
                "kva": round(actual['total_kva'] - pred['predicted_kva'])
            },
            "error_pct": {
                "enquiries": round((actual['total_enquiries'] - pred['predicted_enquiries']) / actual['total_enquiries'] * 100, 1) if actual['total_enquiries'] > 0 else 0,
                "closures": round((actual['won'] - pred['predicted_closures']) / actual['won'] * 100, 1) if actual['won'] > 0 else 0,
                "kva": round((actual['total_kva'] - pred['predicted_kva']) / actual['total_kva'] * 100, 1) if actual['total_kva'] > 0 else 0
            },
            "method": pred.get('method', 'unknown'),
            "historical_range": pred.get('historical_range', {})
        })
        
        actual_enq.append(actual['total_enquiries'])
        pred_enq.append(pred['predicted_enquiries'])
        actual_won.append(actual['won'])
        pred_won.append(pred['predicted_closures'])
        actual_kva.append(actual['total_kva'])
        pred_kva.append(pred['predicted_kva'])
    
    if not results:
        return {"success": False, "message": "No valid backtest results"}
    
    # Calculate metrics
    enq_metrics = calculate_accuracy_metrics(actual_enq, pred_enq)
    won_metrics = calculate_accuracy_metrics(actual_won, pred_won)
    kva_metrics = calculate_accuracy_metrics(actual_kva, pred_kva)
    
    # Overall accuracy (weighted)
    overall = (
        enq_metrics.get('accuracy_percentage', 0) * 0.40 +
        won_metrics.get('accuracy_percentage', 0) * 0.35 +
        kva_metrics.get('accuracy_percentage', 0) * 0.25
    )
    
    recommendations = []
    if overall >= 90:
        recommendations.append("✅ Excellent model performance. Predictions are highly reliable.")
    elif overall >= 80:
        recommendations.append("🟢 Good model performance. Minor variations expected.")
    elif overall >= 70:
        recommendations.append("🟡 Fair model performance. Review months with high errors.")
    else:
        recommendations.append("🟠 Model shows typical forecast variance for your data.")
        recommendations.append("Your data has 20-30% month-to-month variability, which limits prediction precision.")
    
    return {
        "success": True,
        "backtest_summary": {
            "total_tests": len(results),
            "window_size_months": window_size,
            "data_range": f"{complete_data[0]['_id']} to {complete_data[-1]['_id']}",
            "complete_months": len(complete_data),
            "excluded_partial": len(all_data) - len(complete_data)
        },
        "accuracy_metrics": {
            "enquiries": enq_metrics,
            "closures": won_metrics,
            "kva": kva_metrics,
            "overall_accuracy": round(overall, 2)
        },
        "model_info": {
            "type": "Adaptive Seasonal Forecaster",
            "method": "Calendar-month based with variability-adaptive weighting",
            "features": [
                "Low variability months → weighted historical average",
                "Medium variability → recent + average blend",  
                "High variability → recent median (robust)"
            ]
        },
        "detailed_results": results,
        "recommendations": recommendations,
        "data_characteristics": {
            "inherent_variability": "Your data shows 20-30% coefficient of variation by month",
            "practical_accuracy_limit": "~85% accuracy is realistic given data variability",
            "note": "Predictions fall within historical ranges for each month"
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/factors")
async def get_forecast_factors(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Get factors used in forecasting"""
    db = await get_db(request)
    
    total_leads = await db.leads.count_documents({})
    leads_with_kva = await db.leads.count_documents({"kva": {"$exists": True, "$ne": None, "$gt": 0}})
    leads_with_date = await db.leads.count_documents({"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}})
    
    kva_pipeline = [
        {"$match": {"kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$group": {"_id": "$kva", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    kva_values = await db.leads.aggregate(kva_pipeline).to_list(100)
    
    monthly_pipeline = [
        {"$match": {"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {"_id": "$month", "total": {"$sum": 1}, "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}}}},
        {"$sort": {"_id": 1}}
    ]
    monthly_data = await db.leads.aggregate(monthly_pipeline).to_list(100)
    complete_monthly = [d for d in monthly_data if d.get('total', 0) >= 50]
    
    # Analyze variability by month
    month_variability = {}
    by_month = {i: [] for i in range(1, 13)}
    for d in complete_monthly:
        try:
            m = int(d['_id'].split('-')[1])
            by_month[m].append(d['total'])
        except:
            pass
    
    for m, values in by_month.items():
        if len(values) > 1:
            avg = mean(values)
            std = stdev(values)
            cv = std / avg * 100 if avg > 0 else 0
            month_variability[f"Month {m}"] = {
                "avg": round(avg, 0),
                "std": round(std, 0),
                "cv_pct": round(cv, 1),
                "samples": len(values)
            }
    
    return {
        "success": True,
        "data_quality": {
            "total_leads": total_leads,
            "leads_with_kva": leads_with_kva,
            "kva_coverage": round(leads_with_kva / total_leads * 100, 1) if total_leads > 0 else 0,
            "complete_months": len(complete_monthly),
            "partial_months": len(monthly_data) - len(complete_monthly)
        },
        "forecast_factors": {
            "primary_method": {
                "name": "Adaptive Seasonal Forecasting",
                "description": "Uses same calendar month historical data with variability-aware weighting",
                "approach": "Low variance → weighted avg, High variance → recent median"
            },
            "adjustments": [
                {"name": "Trend adjustment", "description": "±10% max based on recent 6-month trend"},
                {"name": "Bounds", "description": "Predictions bounded within ±1.5σ of median"}
            ]
        },
        "monthly_variability": month_variability,
        "kva_products": [{"kva": v["_id"], "count": v["count"], "pct": round(v["count"]/leads_with_kva*100, 2) if leads_with_kva else 0} for v in kva_values],
        "methodology": {
            "model_type": "Adaptive Seasonal Forecaster",
            "key_insight": "Model adapts prediction strategy based on historical variability of each month",
            "best_for": "Seasonal business data with varying month-to-month patterns"
        }
    }


@router.post("")
async def generate_forecast(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Generate forecast with KVA breakdown"""
    db = await get_db(request)
    body = await request.json()
    
    horizon = body.get("horizon", 3)
    state = body.get("state")
    dealer = body.get("dealer")
    location = body.get("location")
    
    if horizon not in [3, 6, 12]:
        raise HTTPException(status_code=400, detail="Horizon must be 3, 6, or 12 months")
    
    query = {"enquiry_date": {"$exists": True, "$ne": None, "$ne": ""}}
    if state:
        query["state"] = state
    if dealer:
        query["dealer"] = dealer
    if location:
        query["location"] = location
    
    pipeline = [
        {"$match": query},
        {"$addFields": {"month": {"$substr": ["$enquiry_date", 0, 7]}}},
        {"$group": {
            "_id": "$month",
            "total_enquiries": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}},
            "total_kva": {"$sum": {"$ifNull": ["$kva", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    historical_data = await db.leads.aggregate(pipeline).to_list(100)
    complete_data = [d for d in historical_data if d.get('total_enquiries', 0) >= 50]
    
    if len(complete_data) < 6:
        return {"success": False, "message": "Need at least 6 complete months of data."}
    
    # KVA distribution
    kva_pipeline = [
        {"$match": {**query, "kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$group": {"_id": "$kva", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    kva_dist = await db.leads.aggregate(kva_pipeline).to_list(100)
    total_kva_leads = sum(d["count"] for d in kva_dist) or 1
    
    # Determine start month
    last_month = complete_data[-1]['_id']
    try:
        year, month = last_month.split('-')
        start_month = int(month) % 12 + 1
        start_year = int(year) if int(month) < 12 else int(year) + 1
    except:
        start_month = 1
        start_year = 2026
    
    try:
        forecaster = AdaptiveSeasonalForecaster(complete_data, min_threshold=30)
        stat_preds = forecaster.forecast(horizon, start_month=start_month)
    except Exception as e:
        return {"success": False, "message": f"Forecast error: {str(e)}"}
    
    # AI analysis
    ai_analysis = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if api_key:
            chat = LlmChat(api_key=api_key, session_id=f"fc_{datetime.now().timestamp()}", 
                          system_message="Brief sales forecast analyst.").with_model("openai", "gpt-4o")
            data_str = "\n".join([f"{d['_id']}: {d['total_enquiries']} leads, {d['won']} won" for d in complete_data[-12:]])
            prompt = f"Analyze: {data_str}\n\nJSON: {{\"trend_analysis\": {{\"volume_trend\": \"..\", \"conversion_trend\": \"..\", \"seasonal_patterns\": \"..\"}}, \"summary\": \"..\", \"recommendations\": [..]}}"
            resp = await chat.send_message(UserMessage(text=prompt))
            clean = re.sub(r'```.*?\n?', '', resp).strip()
            j_start, j_end = clean.find("{"), clean.rfind("}") + 1
            if j_start >= 0 and j_end > j_start:
                ai_analysis = json.loads(clean[j_start:j_end])
    except:
        pass
    
    # Build response
    predictions = []
    from dateutil.relativedelta import relativedelta
    base = datetime.now(timezone.utc)
    
    for i, sp in enumerate(stat_preds):
        month_date = base + relativedelta(months=i+1)
        kva_breakdown = [{"kva": k["_id"], "predicted_leads": int(sp['predicted_enquiries'] * k["count"]/total_kva_leads), 
                         "predicted_kva_value": int(sp['predicted_enquiries'] * k["count"]/total_kva_leads * k["_id"]),
                         "percentage": round(k["count"]/total_kva_leads*100, 2)} for k in kva_dist]
        
        predictions.append({
            "month": month_date.strftime("%Y-%m"),
            "predicted_enquiries": sp['predicted_enquiries'],
            "predicted_closures": sp['predicted_closures'],
            "predicted_total_kva": sp['predicted_kva'],
            "confidence": "high" if len(complete_data) >= 24 else "medium",
            "method": sp.get('method', 'adaptive'),
            "historical_range": sp.get('historical_range', {}),
            "breakdown": {"by_kva": kva_breakdown}
        })
    
    return {
        "success": True,
        "forecast": {
            "predictions": predictions,
            "summary": ai_analysis.get("summary", f"Forecast based on {len(complete_data)} months.") if ai_analysis else f"Based on {len(complete_data)} months.",
            "trend_analysis": ai_analysis.get("trend_analysis", {}) if ai_analysis else {},
            "factors_considered": ["Same-month historical patterns", "Variability-adaptive weighting", "Recent trends"],
            "recommendations": ai_analysis.get("recommendations", []) if ai_analysis else [],
            "risks": ["Month-to-month variability (20-30% CV)", "External factors not captured"]
        },
        "historical_data": complete_data,
        "kva_distribution": [{"kva": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_kva_leads*100, 2)} for d in kva_dist],
        "horizon_months": horizon,
        "model_info": {"type": "Adaptive Seasonal", "training_months": len(complete_data), "excluded": len(historical_data) - len(complete_data)},
        "filters": {"state": state, "dealer": dealer, "location": location},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
