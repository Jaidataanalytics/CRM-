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
    
    n = len(actual)
    
    # Filter out zero actuals for percentage calculations
    valid_pairs = [(a, p) for a, p in zip(actual, predicted) if a > 0]
    
    if not valid_pairs:
        return {"error": "No valid data points"}
    
    # Mean Absolute Error (MAE)
    mae = sum(abs(a - p) for a, p in valid_pairs) / len(valid_pairs)
    
    # Mean Squared Error (MSE)
    mse = sum((a - p) ** 2 for a, p in valid_pairs) / len(valid_pairs)
    
    # Root Mean Squared Error (RMSE)
    rmse = mse ** 0.5
    
    # Mean Absolute Percentage Error (MAPE) - only for non-zero actuals
    mape_values = [abs((a - p) / a) * 100 for a, p in valid_pairs]
    mape = mean(mape_values) if mape_values else 0
    
    # Symmetric MAPE (sMAPE)
    smape_values = []
    for a, p in valid_pairs:
        if (abs(a) + abs(p)) != 0:
            smape_values.append(200 * abs(a - p) / (abs(a) + abs(p)))
    smape = mean(smape_values) if smape_values else 0
    
    # R-squared (Coefficient of Determination)
    actuals_only = [a for a, p in valid_pairs]
    preds_only = [p for a, p in valid_pairs]
    actual_mean = mean(actuals_only)
    ss_tot = sum((a - actual_mean) ** 2 for a in actuals_only)
    ss_res = sum((a - p) ** 2 for a, p in valid_pairs)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
    
    # Accuracy percentage (based on MAPE, capped at 100)
    accuracy_pct = max(0, min(100, 100 - mape))
    
    # Direction accuracy
    direction_correct = 0
    total_direction = 0
    for i in range(1, len(valid_pairs)):
        a_prev, p_prev = valid_pairs[i-1]
        a_curr, p_curr = valid_pairs[i]
        actual_direction = a_curr - a_prev
        predicted_direction = p_curr - p_prev
        if (actual_direction > 0 and predicted_direction > 0) or \
           (actual_direction < 0 and predicted_direction < 0) or \
           (abs(actual_direction) < 10 and abs(predicted_direction) < 10):  # Consider small changes as "same"
            direction_correct += 1
        total_direction += 1
    direction_accuracy = (direction_correct / total_direction * 100) if total_direction > 0 else 0
    
    return {
        "mae": round(mae, 2),
        "mse": round(mse, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "smape": round(smape, 2),
        "r_squared": round(r_squared, 4),
        "accuracy_percentage": round(accuracy_pct, 2),
        "direction_accuracy": round(direction_accuracy, 2),
        "sample_size": len(valid_pairs),
        "interpretation": {
            "mae": f"On average, predictions are off by {round(mae, 0)} units",
            "mape": f"{round(mape, 1)}% average error - {'Excellent' if mape < 10 else 'Good' if mape < 20 else 'Fair' if mape < 30 else 'Needs Improvement'}",
            "r_squared": f"Model explains {round(max(0, r_squared) * 100, 1)}% of variance - {'Excellent' if r_squared > 0.9 else 'Good' if r_squared > 0.7 else 'Fair' if r_squared > 0.5 else 'Moderate'}",
            "direction": f"Correctly predicted direction {round(direction_accuracy, 0)}% of the time"
        }
    }


class SeasonalForecaster:
    """Seasonal forecasting model optimized for lead prediction"""
    
    def __init__(self, historical_data: List[Dict], min_monthly_threshold: int = 50):
        # Filter out incomplete months (likely current/partial months)
        self.data = [d for d in historical_data if d.get('total_enquiries', 0) >= min_monthly_threshold]
        self.n = len(self.data)
        
        if self.n < 3:
            raise ValueError("Insufficient complete data for forecasting")
        
        # Extract time series
        self.enquiries = [d.get('total_enquiries', 0) for d in self.data]
        self.closures = [d.get('won', 0) for d in self.data]
        self.kva = [d.get('total_kva', 0) for d in self.data]
        self.months = [d.get('_id', '') for d in self.data]
        
        # Calculate seasonal indices (based on calendar month)
        self.seasonal_indices_enq = self._calculate_seasonal_indices(self.enquiries, self.months)
        self.seasonal_indices_won = self._calculate_seasonal_indices(self.closures, self.months)
        self.seasonal_indices_kva = self._calculate_seasonal_indices(self.kva, self.months)
        
        # Calculate statistics for bounds
        self.stats = {
            'enquiries': {'mean': mean(self.enquiries), 'std': stdev(self.enquiries) if len(self.enquiries) > 1 else 0},
            'closures': {'mean': mean(self.closures), 'std': stdev(self.closures) if len(self.closures) > 1 else 0},
            'kva': {'mean': mean(self.kva), 'std': stdev(self.kva) if len(self.kva) > 1 else 0}
        }
    
    def _get_month_number(self, month_str: str) -> int:
        """Extract month number (1-12) from YYYY-MM string"""
        try:
            return int(month_str.split('-')[1])
        except:
            return 1
    
    def _calculate_seasonal_indices(self, series: List[float], month_strs: List[str]) -> Dict[int, float]:
        """Calculate monthly seasonal indices based on actual calendar months"""
        if len(series) < 12:
            return {i: 1.0 for i in range(1, 13)}
        
        # Group values by calendar month
        monthly_values = {i: [] for i in range(1, 13)}
        for value, month_str in zip(series, month_strs):
            month_num = self._get_month_number(month_str)
            monthly_values[month_num].append(value)
        
        # Calculate overall mean
        overall_mean = mean(series) if series else 1
        
        # Calculate seasonal index for each month
        indices = {}
        for month, values in monthly_values.items():
            if values and overall_mean > 0:
                # Use weighted average favoring recent years
                weights = [1.5 ** i for i in range(len(values))]
                weighted_mean = sum(v * w for v, w in zip(values, weights)) / sum(weights)
                indices[month] = weighted_mean / overall_mean
            else:
                indices[month] = 1.0
        
        return indices
    
    def _get_same_month_values(self, series: List[float], month_strs: List[str], target_month: int) -> List[float]:
        """Get all historical values for the same calendar month"""
        return [v for v, m in zip(series, month_strs) if self._get_month_number(m) == target_month]
    
    def _weighted_same_month_prediction(self, series: List[float], month_strs: List[str], target_month: int) -> float:
        """Predict based on weighted average of same month in previous years"""
        same_month_values = self._get_same_month_values(series, month_strs, target_month)
        
        if not same_month_values:
            return mean(series) if series else 0
        
        # Weight more recent years exponentially higher
        weights = [2.0 ** i for i in range(len(same_month_values))]
        weighted_avg = sum(v * w for v, w in zip(same_month_values, weights)) / sum(weights)
        
        return weighted_avg
    
    def _recent_trend_adjustment(self, series: List[float], lookback: int = 3) -> float:
        """Calculate recent trend adjustment factor"""
        if len(series) < lookback + 3:
            return 1.0
        
        recent = series[-lookback:]
        older = series[-(lookback*2):-lookback]
        
        if not older:
            return 1.0
        
        recent_avg = mean(recent)
        older_avg = mean(older)
        
        if older_avg > 0:
            trend_factor = recent_avg / older_avg
            # Dampen extreme trends
            trend_factor = max(0.8, min(1.2, trend_factor))
            return trend_factor
        
        return 1.0
    
    def _bound_prediction(self, value: float, stat_key: str, sigma: float = 2.0) -> float:
        """Bound prediction within reasonable range based on historical data"""
        stats = self.stats[stat_key]
        lower = max(0, stats['mean'] - sigma * stats['std'])
        upper = stats['mean'] + sigma * stats['std']
        return max(lower, min(upper, value))
    
    def forecast(self, months_ahead: int, start_month: int = None) -> List[Dict]:
        """Generate seasonal forecast"""
        if self.n < 3:
            return []
        
        # Determine starting month
        if start_month is None:
            last_month_str = self.months[-1]
            start_month = (self._get_month_number(last_month_str) % 12) + 1
        
        # Calculate trend adjustments
        trend_enq = self._recent_trend_adjustment(self.enquiries)
        trend_won = self._recent_trend_adjustment(self.closures)
        trend_kva = self._recent_trend_adjustment(self.kva)
        
        predictions = []
        
        for i in range(months_ahead):
            target_month = ((start_month - 1 + i) % 12) + 1
            
            # Same-month weighted prediction (primary method - 70% weight)
            sm_pred_enq = self._weighted_same_month_prediction(self.enquiries, self.months, target_month)
            sm_pred_won = self._weighted_same_month_prediction(self.closures, self.months, target_month)
            sm_pred_kva = self._weighted_same_month_prediction(self.kva, self.months, target_month)
            
            # Seasonal-adjusted recent average (secondary method - 30% weight)
            recent_avg_enq = mean(self.enquiries[-6:]) if len(self.enquiries) >= 6 else mean(self.enquiries)
            recent_avg_won = mean(self.closures[-6:]) if len(self.closures) >= 6 else mean(self.closures)
            recent_avg_kva = mean(self.kva[-6:]) if len(self.kva) >= 6 else mean(self.kva)
            
            sa_pred_enq = recent_avg_enq * self.seasonal_indices_enq.get(target_month, 1.0)
            sa_pred_won = recent_avg_won * self.seasonal_indices_won.get(target_month, 1.0)
            sa_pred_kva = recent_avg_kva * self.seasonal_indices_kva.get(target_month, 1.0)
            
            # Ensemble: 70% same-month, 30% seasonal-adjusted recent
            final_enq = 0.70 * sm_pred_enq + 0.30 * sa_pred_enq
            final_won = 0.70 * sm_pred_won + 0.30 * sa_pred_won
            final_kva = 0.70 * sm_pred_kva + 0.30 * sa_pred_kva
            
            # Apply light trend adjustment
            final_enq *= trend_enq
            final_won *= trend_won
            final_kva *= trend_kva
            
            # Bound predictions
            final_enq = self._bound_prediction(final_enq, 'enquiries')
            final_won = self._bound_prediction(final_won, 'closures')
            final_kva = self._bound_prediction(final_kva, 'kva')
            
            predictions.append({
                'predicted_enquiries': max(1, int(round(final_enq))),
                'predicted_closures': max(0, int(round(final_won))),
                'predicted_kva': max(0, int(round(final_kva))),
                'forecast_month': target_month,
                'seasonal_index': round(self.seasonal_indices_enq.get(target_month, 1.0), 3),
                'components': {
                    'same_month_avg': {'enq': round(sm_pred_enq), 'won': round(sm_pred_won)},
                    'seasonal_adjusted': {'enq': round(sa_pred_enq), 'won': round(sa_pred_won)},
                    'trend_factor': {'enq': round(trend_enq, 3), 'won': round(trend_won, 3)}
                }
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
    
    window_size = body.get("window_size", 12)
    test_periods = body.get("test_periods", 12)
    
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
    
    # Filter out incomplete months (less than 50 entries likely means partial month)
    complete_data = [d for d in all_data if d.get('total_enquiries', 0) >= 50]
    
    if len(complete_data) < window_size + test_periods:
        return {
            "success": False,
            "message": f"Insufficient complete data. Need {window_size + test_periods} months, have {len(complete_data)} complete months.",
            "note": f"Excluded {len(all_data) - len(complete_data)} incomplete/partial months"
        }
    
    # Rolling window backtest
    backtest_results = []
    all_actual_enquiries = []
    all_predicted_enquiries = []
    all_actual_closures = []
    all_predicted_closures = []
    all_actual_kva = []
    all_predicted_kva = []
    
    # Test on the most recent complete months
    num_tests = min(test_periods, len(complete_data) - window_size)
    
    for i in range(num_tests):
        # Use a sliding window
        test_idx = len(complete_data) - num_tests + i
        train_end = test_idx
        train_start = max(0, train_end - window_size)
        
        if train_end <= train_start or test_idx >= len(complete_data):
            continue
        
        train_data = complete_data[train_start:train_end]
        actual_data = complete_data[test_idx]
        
        # Get the month number for the test period
        test_month_str = actual_data['_id']
        try:
            test_month_num = int(test_month_str.split('-')[1])
        except:
            test_month_num = 1
        
        try:
            # Generate prediction using seasonal forecaster
            forecaster = SeasonalForecaster(train_data, min_monthly_threshold=30)
            predictions = forecaster.forecast(1, start_month=test_month_num)
            
            if not predictions:
                continue
            
            prediction = predictions[0]
        except Exception as e:
            logger.warning(f"Forecast failed for test {i}: {e}")
            continue
        
        # Record results
        result = {
            "training_period": f"{train_data[0]['_id']} to {train_data[-1]['_id']}",
            "training_months": len(train_data),
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
            },
            "seasonal_index": prediction.get('seasonal_index', 1.0)
        }
        backtest_results.append(result)
        
        # Collect for aggregate metrics
        all_actual_enquiries.append(actual_data['total_enquiries'])
        all_predicted_enquiries.append(prediction['predicted_enquiries'])
        all_actual_closures.append(actual_data['won'])
        all_predicted_closures.append(prediction['predicted_closures'])
        all_actual_kva.append(actual_data['total_kva'])
        all_predicted_kva.append(prediction['predicted_kva'])
    
    if not backtest_results:
        return {
            "success": False,
            "message": "Could not generate any valid backtest results"
        }
    
    # Calculate aggregate metrics
    enquiry_metrics = calculate_accuracy_metrics(all_actual_enquiries, all_predicted_enquiries)
    closure_metrics = calculate_accuracy_metrics(all_actual_closures, all_predicted_closures)
    kva_metrics = calculate_accuracy_metrics(all_actual_kva, all_predicted_kva)
    
    # Overall accuracy (weighted average)
    overall_accuracy = (
        enquiry_metrics.get('accuracy_percentage', 0) * 0.40 +
        closure_metrics.get('accuracy_percentage', 0) * 0.35 +
        kva_metrics.get('accuracy_percentage', 0) * 0.25
    )
    
    # Recommendations
    recommendations = []
    if overall_accuracy >= 90:
        recommendations.append("✅ Model accuracy is excellent. Continue monitoring for drift.")
    elif overall_accuracy >= 80:
        recommendations.append("🟡 Model accuracy is good. Minor tuning may improve results.")
    else:
        recommendations.append("Consider reviewing data quality for anomalous months.")
        recommendations.append("Seasonal patterns may be shifting - review recent trends.")
    
    return {
        "success": True,
        "backtest_summary": {
            "total_tests": len(backtest_results),
            "window_size_months": window_size,
            "data_range": f"{complete_data[0]['_id']} to {complete_data[-1]['_id']}",
            "total_complete_months": len(complete_data),
            "excluded_partial_months": len(all_data) - len(complete_data)
        },
        "accuracy_metrics": {
            "enquiries": enquiry_metrics,
            "closures": closure_metrics,
            "kva": kva_metrics,
            "overall_accuracy": round(overall_accuracy, 2)
        },
        "model_info": {
            "type": "Seasonal Ensemble (Same-Month Average + Seasonal Adjustment)",
            "weights": {
                "same_month_historical": "70%",
                "seasonal_adjusted_recent": "30%"
            },
            "seasonality": "12-month calendar cycle",
            "trend_adjustment": "3-month lookback with dampening"
        },
        "detailed_results": backtest_results,
        "recommendations": recommendations,
        "factors_used": [
            "Same calendar month historical values (recency-weighted)",
            "12-month seasonal indices",
            "Recent trend adjustment (dampened)",
            "Statistical bounds (±2σ)"
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
    
    # Filter complete months
    complete_monthly = [d for d in monthly_data if d.get('total', 0) >= 50]
    
    # Calculate seasonal indices
    seasonal_indices = {}
    if complete_monthly:
        try:
            forecaster = SeasonalForecaster(complete_monthly, min_monthly_threshold=30)
            seasonal_indices = forecaster.seasonal_indices_enq
        except:
            seasonal_indices = {i: 1.0 for i in range(1, 13)}
    
    return {
        "success": True,
        "data_quality": {
            "total_leads": total_leads,
            "leads_with_kva": leads_with_kva,
            "kva_coverage": round(leads_with_kva / total_leads * 100, 1) if total_leads > 0 else 0,
            "leads_with_date": leads_with_date,
            "date_coverage": round(leads_with_date / total_leads * 100, 1) if total_leads > 0 else 0,
            "months_of_data": len(monthly_data),
            "complete_months": len(complete_monthly),
            "partial_months_excluded": len(monthly_data) - len(complete_monthly)
        },
        "forecast_factors": {
            "primary_factors": [
                {
                    "name": "Same-Month Historical Average",
                    "description": "Weighted average of same calendar month from previous years, with exponential recency weighting",
                    "weight": "70%",
                    "rationale": "Most reliable predictor due to strong seasonal patterns"
                },
                {
                    "name": "Seasonal-Adjusted Recent Average",
                    "description": "Recent 6-month average adjusted by seasonal index",
                    "weight": "30%",
                    "rationale": "Captures recent trends while respecting seasonality"
                }
            ],
            "seasonal_indices": {
                "description": "Monthly adjustment factors - values > 1 indicate higher-than-average months",
                "values": {f"Month {k}": round(v, 3) for k, v in seasonal_indices.items()}
            },
            "adjustments": [
                {
                    "name": "Trend Adjustment",
                    "description": "3-month lookback trend factor, dampened to ±20%",
                    "purpose": "Account for recent momentum"
                },
                {
                    "name": "Statistical Bounds",
                    "description": "Predictions bounded within ±2 standard deviations",
                    "purpose": "Prevent extreme predictions"
                }
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
            "model_type": "Seasonal Ensemble Model",
            "primary_method": "Same-Month Historical Average (70%)",
            "secondary_method": "Seasonal-Adjusted Recent Average (30%)",
            "seasonality": "12-month calendar cycle with recency weighting",
            "data_filtering": "Excludes incomplete/partial months (<50 entries)"
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
    
    # Filter complete months
    complete_data = [d for d in historical_data if d.get('total_enquiries', 0) >= 50]
    
    if len(complete_data) < 3:
        return {
            "success": False,
            "message": "Insufficient complete data for forecasting. Need at least 3 complete months.",
            "historical_data": historical_data
        }
    
    # Get KVA distribution
    kva_dist_pipeline = [
        {"$match": {**query, "kva": {"$exists": True, "$ne": None, "$gt": 0}}},
        {"$group": {"_id": "$kva", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    kva_distribution = await db.leads.aggregate(kva_dist_pipeline).to_list(100)
    total_kva_leads = sum([d["count"] for d in kva_distribution]) if kva_distribution else 1
    
    # Determine starting month for forecast
    last_complete_month = complete_data[-1]['_id']
    try:
        year, month = last_complete_month.split('-')
        start_month = int(month) % 12 + 1
        start_year = int(year) if int(month) < 12 else int(year) + 1
    except:
        start_month = 1
        start_year = 2026
    
    # Generate statistical predictions
    try:
        forecaster = SeasonalForecaster(complete_data, min_monthly_threshold=30)
        statistical_predictions = forecaster.forecast(horizon, start_month=start_month)
    except Exception as e:
        logger.error(f"Forecaster error: {e}")
        return {
            "success": False,
            "message": f"Forecast generation failed: {str(e)}"
        }
    
    # Generate AI analysis
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        ai_analysis = None
        
        if api_key:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"forecast_{current_user.user_id}_{datetime.now().timestamp()}",
                system_message="You are a sales forecasting analyst. Provide brief, actionable insights."
            ).with_model("openai", "gpt-4o")
            
            data_summary = "\n".join([
                f"{d['_id']}: {d['total_enquiries']} enquiries, {d['won']} won"
                for d in complete_data[-12:]
            ])
            
            prompt = f"""Analyze this lead data for a generator company:

{data_summary}

Provide JSON with: {{"trend_analysis": {{"volume_trend": "...", "conversion_trend": "...", "kva_mix_trend": "...", "seasonal_patterns": "..."}}, "summary": "...", "factors_considered": [...], "recommendations": [...], "risks": [...]}}"""

            try:
                response = await chat.send_message(UserMessage(text=prompt))
                clean = re.sub(r'```json?\s*\n?', '', response).replace('```', '').strip()
                json_start = clean.find("{")
                json_end = clean.rfind("}") + 1
                if json_start != -1 and json_end > json_start:
                    ai_analysis = json.loads(clean[json_start:json_end])
            except:
                pass
    except:
        ai_analysis = None
    
    # Build final predictions
    predictions = []
    from dateutil.relativedelta import relativedelta
    base_date = datetime.now(timezone.utc)
    
    for i, stat_pred in enumerate(statistical_predictions):
        month_date = base_date + relativedelta(months=i+1)
        
        # KVA breakdown
        kva_breakdown = []
        for kv in kva_distribution:
            pct = kv["count"] / total_kva_leads
            pred_leads = int(stat_pred['predicted_enquiries'] * pct)
            kva_breakdown.append({
                "kva": kv["_id"],
                "predicted_leads": pred_leads,
                "predicted_kva_value": pred_leads * kv["_id"],
                "percentage": round(pct * 100, 2)
            })
        
        predictions.append({
            "month": month_date.strftime("%Y-%m"),
            "predicted_enquiries": stat_pred['predicted_enquiries'],
            "predicted_closures": stat_pred['predicted_closures'],
            "predicted_total_kva": stat_pred['predicted_kva'],
            "confidence": "high" if len(complete_data) >= 24 else "medium",
            "seasonal_index": stat_pred.get('seasonal_index', 1.0),
            "breakdown": {"by_kva": kva_breakdown}
        })
    
    forecast_json = {
        "predictions": predictions,
        "summary": ai_analysis.get("summary", f"Forecast based on {len(complete_data)} months of complete data.") if ai_analysis else f"Forecast based on {len(complete_data)} months of data.",
        "trend_analysis": ai_analysis.get("trend_analysis", {}) if ai_analysis else {},
        "factors_considered": ai_analysis.get("factors_considered", ["Seasonal patterns", "Historical averages", "Recent trends"]) if ai_analysis else [],
        "recommendations": ai_analysis.get("recommendations", []) if ai_analysis else [],
        "risks": ai_analysis.get("risks", []) if ai_analysis else []
    }
    
    return {
        "success": True,
        "forecast": forecast_json,
        "historical_data": complete_data,
        "kva_distribution": [{"kva": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_kva_leads*100, 2)} for d in kva_distribution],
        "horizon_months": horizon,
        "model_info": {
            "type": "Seasonal Ensemble (Same-Month 70% + Seasonal-Adjusted 30%)",
            "training_months": len(complete_data),
            "excluded_partial_months": len(historical_data) - len(complete_data)
        },
        "filters": {"state": state, "dealer": dealer, "location": location},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
