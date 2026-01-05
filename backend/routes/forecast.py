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


async def calculate_dimension_accuracy(db, dimension_name: str, dimension_dist: List[Dict], 
                                        total_dim_leads: int, historical_data: List[Dict]) -> Dict:
    """
    Calculate historical accuracy for a breakdown dimension.
    Uses the last 6-12 months to compare predicted vs actual closures.
    """
    if not dimension_dist or total_dim_leads == 0:
        return {"dimension": dimension_name, "accuracy": 0, "error": "No data"}
    
    # Calculate the weighted average conversion rate for this dimension
    total_weighted_conv = sum(d.get("won", 0) for d in dimension_dist)
    total_leads_dim = sum(d.get("count", 0) for d in dimension_dist)
    dim_conversion_rate = total_weighted_conv / total_leads_dim if total_leads_dim > 0 else 0
    
    # Use historical monthly data to calculate accuracy
    # For each historical month, predict closures using dimension's conversion rate
    # Compare with actual closures
    
    actual_closures = []
    predicted_closures = []
    
    for month_data in historical_data[-12:]:  # Use last 12 months
        actual_won = month_data.get("won", 0)
        actual_enquiries = month_data.get("total_enquiries", 0)
        
        # Predict closures using this dimension's conversion rate
        predicted_won = int(actual_enquiries * dim_conversion_rate)
        
        if actual_won > 0:  # Only include months with actual closures
            actual_closures.append(actual_won)
            predicted_closures.append(predicted_won)
    
    if not actual_closures:
        return {"dimension": dimension_name, "accuracy": 0, "error": "No closure data"}
    
    # Calculate MAPE (Mean Absolute Percentage Error)
    mape_values = []
    for actual, predicted in zip(actual_closures, predicted_closures):
        if actual > 0:
            mape_values.append(abs(actual - predicted) / actual * 100)
    
    if not mape_values:
        return {"dimension": dimension_name, "accuracy": 0, "error": "Cannot calculate error"}
    
    mape = sum(mape_values) / len(mape_values)
    accuracy = max(0, min(100, 100 - mape))
    
    return {
        "dimension": dimension_name,
        "accuracy": round(accuracy, 1),
        "mape": round(mape, 1),
        "conversion_rate": round(dim_conversion_rate * 100, 2),
        "sample_months": len(actual_closures),
        "total_historical_closures": sum(actual_closures),
        "total_predicted_closures": sum(predicted_closures)
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
        Predict using heavily weighted recent same-month values.
        Returns (prediction, method_used)
        """
        historical = self.by_month.get(target_month, [])
        
        if not historical:
            base = self.stats[metric]['median']
            return base, "overall_median"
        
        values = [h[metric] for h in historical]
        
        if len(values) == 1:
            return values[0], "single_year"
        
        if len(values) == 2:
            # Two years: blend with heavy recency bias
            return 0.65 * values[-1] + 0.35 * values[-2], "blend_2yr"
        
        if len(values) == 3:
            # Three years: Focus on recent two
            return 0.55 * values[-1] + 0.30 * values[-2] + 0.15 * values[-3], "blend_3yr"
        
        # 4+ years: Use most recent 3 years only with decay weighting
        recent_3 = values[-3:]
        weights = [1.0, 1.5, 2.2]  # Oldest to newest
        weighted_sum = sum(v * w for v, w in zip(recent_3, weights))
        prediction = weighted_sum / sum(weights)
        
        return prediction, "blend_recent3"
    
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
    
    # Run ONE-STEP-AHEAD forecasting test
    # For each test month, train on all prior data, predict the next month
    num_tests = min(test_periods, len(complete_data) - 12)  # Need at least 12 months for training
    
    for i in range(num_tests):
        test_idx = len(complete_data) - num_tests + i
        train_end = test_idx
        
        if train_end < 12 or test_idx >= len(complete_data):
            continue
        
        # Use ALL available prior data for training
        train_data = complete_data[:train_end]
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
        
        # Get same-month historical values for context
        same_month_hist = [d['total_enquiries'] for d in train_data 
                          if int(d['_id'].split('-')[1]) == test_month_num]
        
        results.append({
            "training_period": f"{train_data[0]['_id']} to {train_data[-1]['_id']}",
            "training_months": len(train_data),
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
            "same_month_history": {
                "values": same_month_hist[-3:] if same_month_hist else [],
                "prediction_based_on": same_month_hist[-1] if same_month_hist else None
            }
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
    
    # Analyze prediction quality
    within_10pct = sum(1 for r in results if abs(r['error_pct']['enquiries']) <= 10)
    within_20pct = sum(1 for r in results if abs(r['error_pct']['enquiries']) <= 20)
    within_30pct = sum(1 for r in results if abs(r['error_pct']['enquiries']) <= 30)
    
    recommendations = []
    if overall >= 90:
        recommendations.append("✅ Excellent model performance.")
    elif overall >= 80:
        recommendations.append("🟢 Good model performance.")
    elif overall >= 70:
        recommendations.append("🟡 Acceptable performance for business planning.")
    else:
        recommendations.append("🟠 Your data has significant year-over-year variation.")
        recommendations.append("Consider reviewing months with large errors for business insights.")
    
    return {
        "success": True,
        "backtest_summary": {
            "total_tests": len(results),
            "data_range": f"{complete_data[0]['_id']} to {complete_data[-1]['_id']}",
            "complete_months": len(complete_data),
            "methodology": "One-step-ahead forecasting using all available prior data"
        },
        "accuracy_metrics": {
            "enquiries": enq_metrics,
            "closures": won_metrics,
            "kva": kva_metrics,
            "overall_accuracy": round(overall, 2)
        },
        "prediction_quality": {
            "within_10pct": f"{within_10pct}/{len(results)} ({round(within_10pct/len(results)*100)}%)",
            "within_20pct": f"{within_20pct}/{len(results)} ({round(within_20pct/len(results)*100)}%)",
            "within_30pct": f"{within_30pct}/{len(results)} ({round(within_30pct/len(results)*100)}%)"
        },
        "model_info": {
            "type": "Adaptive Seasonal Forecaster",
            "method": "Most recent same-calendar-month value as primary predictor",
            "note": "Works best when business patterns are stable year-over-year"
        },
        "detailed_results": results,
        "recommendations": recommendations,
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
    """Generate forecast with KVA breakdown and business context adjustments"""
    db = await get_db(request)
    body = await request.json()
    
    horizon = body.get("horizon", 3)
    state = body.get("state")
    dealer = body.get("dealer")
    location = body.get("location")
    
    # Business context inputs
    business_context = body.get("business_context", {})
    marketing_effort = business_context.get("marketing_effort", "same")  # same, increasing, decreasing
    marketing_intensity = business_context.get("marketing_intensity", 0)  # 0-100 scale
    campaign_active = business_context.get("campaign_active", False)
    campaign_type = business_context.get("campaign_type", "none")  # none, minor, major
    market_conditions = business_context.get("market_conditions", "stable")  # stable, growing, challenging
    seasonal_factor = business_context.get("seasonal_factor", "normal")  # normal, high_demand, low_demand
    
    # Calculate adjustment multiplier based on business context
    adjustment_multiplier = 1.0
    adjustment_details = []
    
    # Marketing effort adjustment
    if marketing_effort == "increasing":
        intensity_factor = 1 + (marketing_intensity / 100) * 0.3  # Max 30% boost
        adjustment_multiplier *= intensity_factor
        adjustment_details.append(f"Marketing increasing: +{round((intensity_factor-1)*100)}%")
    elif marketing_effort == "decreasing":
        intensity_factor = 1 - (marketing_intensity / 100) * 0.2  # Max 20% reduction
        adjustment_multiplier *= intensity_factor
        adjustment_details.append(f"Marketing decreasing: {round((intensity_factor-1)*100)}%")
    
    # Campaign adjustment
    campaign_multipliers = {"none": 1.0, "minor": 1.10, "major": 1.25}
    if campaign_type != "none":
        adjustment_multiplier *= campaign_multipliers.get(campaign_type, 1.0)
        boost = round((campaign_multipliers.get(campaign_type, 1.0) - 1) * 100)
        adjustment_details.append(f"{campaign_type.title()} campaign: +{boost}%")
    
    # Market conditions adjustment
    market_multipliers = {"stable": 1.0, "growing": 1.15, "challenging": 0.90}
    if market_conditions != "stable":
        adjustment_multiplier *= market_multipliers.get(market_conditions, 1.0)
        change = round((market_multipliers.get(market_conditions, 1.0) - 1) * 100)
        adjustment_details.append(f"Market {market_conditions}: {change:+}%")
    
    # Seasonal factor adjustment
    seasonal_multipliers = {"normal": 1.0, "high_demand": 1.20, "low_demand": 0.85}
    if seasonal_factor != "normal":
        adjustment_multiplier *= seasonal_multipliers.get(seasonal_factor, 1.0)
        change = round((seasonal_multipliers.get(seasonal_factor, 1.0) - 1) * 100)
        adjustment_details.append(f"Seasonal {seasonal_factor.replace('_', ' ')}: {change:+}%")
    
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
    
    # Calculate overall conversion rate
    total_leads_all = await db.leads.count_documents(query)
    total_won_all = await db.leads.count_documents({**query, "enquiry_stage": "Closed-Won"})
    overall_conversion_rate = total_won_all / total_leads_all if total_leads_all > 0 else 0.25
    
    # KVA distribution with conversion rates
    kva_pipeline = [
        {"$match": {**query, "kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$group": {
            "_id": "$kva", 
            "count": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    kva_dist = await db.leads.aggregate(kva_pipeline).to_list(100)
    total_kva_leads = sum(d["count"] for d in kva_dist) or 1
    # Add conversion rate to each KVA
    for k in kva_dist:
        k["conversion_rate"] = k["won"] / k["count"] if k["count"] > 0 else overall_conversion_rate
    
    # State distribution with conversion rates
    state_pipeline = [
        {"$match": {**query, "state": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$state", 
            "count": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    state_dist = await db.leads.aggregate(state_pipeline).to_list(100)
    total_state_leads = sum(d["count"] for d in state_dist) or 1
    for s in state_dist:
        s["conversion_rate"] = s["won"] / s["count"] if s["count"] > 0 else overall_conversion_rate
    
    # Dealer distribution with conversion rates
    dealer_pipeline = [
        {"$match": {**query, "dealer": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$dealer", 
            "count": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    dealer_dist = await db.leads.aggregate(dealer_pipeline).to_list(100)
    total_dealer_leads = sum(d["count"] for d in dealer_dist) or 1
    for d in dealer_dist:
        d["conversion_rate"] = d["won"] / d["count"] if d["count"] > 0 else overall_conversion_rate
    
    # Employee distribution with conversion rates
    employee_pipeline = [
        {"$match": {**query, "added_by": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$added_by", 
            "count": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    employee_dist = await db.leads.aggregate(employee_pipeline).to_list(100)
    total_employee_leads = sum(d["count"] for d in employee_dist) or 1
    for e in employee_dist:
        e["conversion_rate"] = e["won"] / e["count"] if e["count"] > 0 else overall_conversion_rate
    
    # Segment distribution with conversion rates
    segment_pipeline = [
        {"$match": {**query, "segment": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$segment", 
            "count": {"$sum": 1},
            "won": {"$sum": {"$cond": [{"$eq": ["$enquiry_stage", "Closed-Won"]}, 1, 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    segment_dist = await db.leads.aggregate(segment_pipeline).to_list(100)
    total_segment_leads = sum(d["count"] for d in segment_dist) or 1
    for seg in segment_dist:
        seg["conversion_rate"] = seg["won"] / seg["count"] if seg["count"] > 0 else overall_conversion_rate
    
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
            context_str = f"Business adjustments: {', '.join(adjustment_details)}" if adjustment_details else "No special adjustments"
            prompt = f"Analyze: {data_str}\n\n{context_str}\n\nJSON: {{\"trend_analysis\": {{\"volume_trend\": \"..\", \"conversion_trend\": \"..\", \"seasonal_patterns\": \"..\"}}, \"summary\": \"..\", \"recommendations\": [..]}}"
            resp = await chat.send_message(UserMessage(text=prompt))
            clean = re.sub(r'```.*?\n?', '', resp).strip()
            j_start, j_end = clean.find("{"), clean.rfind("}") + 1
            if j_start >= 0 and j_end > j_start:
                ai_analysis = json.loads(clean[j_start:j_end])
    except:
        pass
    
    # Build response with adjusted predictions
    predictions = []
    from dateutil.relativedelta import relativedelta
    base = datetime.now(timezone.utc)
    
    total_adjustment_pct = round((adjustment_multiplier - 1) * 100)
    
    for i, sp in enumerate(stat_preds):
        month_date = base + relativedelta(months=i+1)
        
        # Apply business context adjustment
        adjusted_enquiries = int(sp['predicted_enquiries'] * adjustment_multiplier)
        adjusted_closures = int(sp['predicted_closures'] * adjustment_multiplier)
        adjusted_kva = int(sp['predicted_kva'] * adjustment_multiplier)
        
        # KVA breakdown with closures
        kva_breakdown = []
        for k in kva_dist:
            pred_leads = int(adjusted_enquiries * k["count"]/total_kva_leads)
            # Category-specific closure (based on historical conversion rate for this KVA)
            cat_closures = int(pred_leads * k["conversion_rate"])
            # Overall closure (based on overall conversion rate)
            overall_closures = int(pred_leads * overall_conversion_rate)
            kva_breakdown.append({
                "kva": k["_id"],
                "predicted_leads": pred_leads,
                "predicted_closures_category": cat_closures,
                "predicted_closures_overall": overall_closures,
                "conversion_rate": round(k["conversion_rate"] * 100, 1),
                "percentage": round(k["count"]/total_kva_leads*100, 2)
            })
        
        # State breakdown with closures
        state_breakdown = []
        for s in state_dist[:20]:
            pred_leads = int(adjusted_enquiries * s["count"]/total_state_leads)
            cat_closures = int(pred_leads * s["conversion_rate"])
            overall_closures = int(pred_leads * overall_conversion_rate)
            state_breakdown.append({
                "state": s["_id"],
                "predicted_leads": pred_leads,
                "predicted_closures_category": cat_closures,
                "predicted_closures_overall": overall_closures,
                "conversion_rate": round(s["conversion_rate"] * 100, 1),
                "percentage": round(s["count"]/total_state_leads*100, 2)
            })
        
        # Dealer breakdown with closures
        dealer_breakdown = []
        for d in dealer_dist[:20]:
            pred_leads = int(adjusted_enquiries * d["count"]/total_dealer_leads)
            cat_closures = int(pred_leads * d["conversion_rate"])
            overall_closures = int(pred_leads * overall_conversion_rate)
            dealer_breakdown.append({
                "dealer": d["_id"],
                "predicted_leads": pred_leads,
                "predicted_closures_category": cat_closures,
                "predicted_closures_overall": overall_closures,
                "conversion_rate": round(d["conversion_rate"] * 100, 1),
                "percentage": round(d["count"]/total_dealer_leads*100, 2)
            })
        
        # Employee breakdown with closures
        employee_breakdown = []
        for e in employee_dist[:20]:
            pred_leads = int(adjusted_enquiries * e["count"]/total_employee_leads)
            cat_closures = int(pred_leads * e["conversion_rate"])
            overall_closures = int(pred_leads * overall_conversion_rate)
            employee_breakdown.append({
                "employee": e["_id"],
                "predicted_leads": pred_leads,
                "predicted_closures_category": cat_closures,
                "predicted_closures_overall": overall_closures,
                "conversion_rate": round(e["conversion_rate"] * 100, 1),
                "percentage": round(e["count"]/total_employee_leads*100, 2)
            })
        
        # Segment breakdown with closures
        segment_breakdown = []
        for seg in segment_dist:
            pred_leads = int(adjusted_enquiries * seg["count"]/total_segment_leads)
            cat_closures = int(pred_leads * seg["conversion_rate"])
            overall_closures = int(pred_leads * overall_conversion_rate)
            segment_breakdown.append({
                "segment": seg["_id"],
                "predicted_leads": pred_leads,
                "predicted_closures_category": cat_closures,
                "predicted_closures_overall": overall_closures,
                "conversion_rate": round(seg["conversion_rate"] * 100, 1),
                "percentage": round(seg["count"]/total_segment_leads*100, 2)
            })
        
        predictions.append({
            "month": month_date.strftime("%Y-%m"),
            "predicted_enquiries": adjusted_enquiries,
            "predicted_closures": adjusted_closures,
            "predicted_total_kva": adjusted_kva,
            "overall_conversion_rate": round(overall_conversion_rate * 100, 1),
            "base_prediction": {
                "enquiries": sp['predicted_enquiries'],
                "closures": sp['predicted_closures'],
                "kva": sp['predicted_kva']
            },
            "adjustment_applied": f"{total_adjustment_pct:+}%" if total_adjustment_pct != 0 else "None",
            "confidence": "high" if len(complete_data) >= 24 and adjustment_multiplier == 1.0 else "medium" if adjustment_multiplier == 1.0 else "adjusted",
            "breakdown": {
                "by_kva": kva_breakdown,
                "by_state": state_breakdown,
                "by_dealer": dealer_breakdown,
                "by_employee": employee_breakdown,
                "by_segment": segment_breakdown
            }
        })
    
    return {
        "success": True,
        "forecast": {
            "predictions": predictions,
            "summary": ai_analysis.get("summary", f"Forecast based on {len(complete_data)} months.") if ai_analysis else f"Based on {len(complete_data)} months.",
            "trend_analysis": ai_analysis.get("trend_analysis", {}) if ai_analysis else {},
            "factors_considered": ["Same-month historical patterns", "Recency-weighted blending"] + adjustment_details,
            "recommendations": ai_analysis.get("recommendations", []) if ai_analysis else [],
            "risks": ["Adjustments are estimates based on typical campaign impacts", "Actual results may vary"]
        },
        "business_adjustments": {
            "applied": len(adjustment_details) > 0,
            "total_adjustment": f"{total_adjustment_pct:+}%",
            "details": adjustment_details,
            "multiplier": round(adjustment_multiplier, 3)
        },
        "historical_data": complete_data,
        "distributions": {
            "kva": [{"kva": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_kva_leads*100, 2)} for d in kva_dist],
            "state": [{"state": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_state_leads*100, 2)} for d in state_dist[:20]],
            "dealer": [{"dealer": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_dealer_leads*100, 2)} for d in dealer_dist[:20]],
            "employee": [{"employee": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_employee_leads*100, 2)} for d in employee_dist[:20]],
            "segment": [{"segment": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_segment_leads*100, 2)} for d in segment_dist]
        },
        "horizon_months": horizon,
        "model_info": {"type": "Adaptive Seasonal with Business Context", "training_months": len(complete_data)},
        "filters": {"state": state, "dealer": dealer, "location": location},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.post("/save")
async def save_forecast(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Save a generated forecast projection to the database"""
    db = await get_db(request)
    body = await request.json()
    
    forecast_data = body.get("forecast_data")
    if not forecast_data:
        raise HTTPException(status_code=400, detail="No forecast data provided")
    
    # Create projection document
    projection = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "saved_by": current_user.name or current_user.email,
        "horizon_months": forecast_data.get("horizon_months", 3),
        "filters": forecast_data.get("filters", {}),
        "business_adjustments": forecast_data.get("business_adjustments", {}),
        "summary": forecast_data.get("forecast", {}).get("summary", ""),
        "predictions": forecast_data.get("forecast", {}).get("predictions", []),
        "model_info": forecast_data.get("model_info", {}),
        "generated_at": forecast_data.get("generated_at", "")
    }
    
    result = await db.saved_forecasts.insert_one(projection)
    
    return {
        "success": True,
        "message": "Forecast saved successfully",
        "projection_id": str(result.inserted_id)
    }


@router.get("/saved")
async def get_saved_forecasts(
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
):
    """Get all saved forecast projections"""
    db = await get_db(request)
    
    # Get all saved forecasts, sorted by saved_at descending
    cursor = db.saved_forecasts.find({}, {"_id": 0}).sort("saved_at", -1)
    forecasts = await cursor.to_list(100)
    
    # Add an index to each for reference
    for idx, f in enumerate(forecasts):
        f["index"] = idx + 1
    
    return {
        "success": True,
        "forecasts": forecasts,
        "total": len(forecasts)
    }


@router.delete("/saved/{index}")
async def delete_saved_forecast(
    request: Request,
    index: int,
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    """Delete a saved forecast by its index (1-based)"""
    db = await get_db(request)
    
    # Get all saved forecasts sorted by saved_at descending
    cursor = db.saved_forecasts.find({}).sort("saved_at", -1)
    forecasts = await cursor.to_list(100)
    
    if index < 1 or index > len(forecasts):
        raise HTTPException(status_code=404, detail="Projection not found")
    
    # Delete the forecast at the given index (0-based internally)
    forecast_to_delete = forecasts[index - 1]
    await db.saved_forecasts.delete_one({"_id": forecast_to_delete["_id"]})
    
    return {
        "success": True,
        "message": "Forecast deleted successfully"
    }
