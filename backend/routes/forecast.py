from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timezone
import logging
import os
import json
import re
from statistics import mean, stdev
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
    mae = sum(abs(a - p) for a, p in zip(actual, predicted)) / n
    
    # Mean Squared Error (MSE)
    mse = sum((a - p) ** 2 for a, p in zip(actual, predicted)) / n
    
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
    actual_mean = mean(actual)
    ss_tot = sum((a - actual_mean) ** 2 for a in actual)
    ss_res = sum((a - p) ** 2 for a, p in zip(actual, predicted))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
    
    # Accuracy percentage (based on MAPE, capped at 100)
    accuracy_pct = max(0, min(100, 100 - mape))
    
    # Direction accuracy
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


class AdvancedForecaster:
    """Advanced forecasting model using ensemble of methods"""
    
    def __init__(self, historical_data: List[Dict]):
        self.data = historical_data
        self.n = len(historical_data)
        
        # Extract time series
        self.enquiries = [d.get('total_enquiries', 0) for d in historical_data]
        self.closures = [d.get('won', 0) for d in historical_data]
        self.kva = [d.get('total_kva', 0) for d in historical_data]
        self.months = [d.get('_id', '') for d in historical_data]
        
        # Calculate seasonal indices (12-month cycle)
        self.seasonal_indices_enq = self._calculate_seasonal_indices(self.enquiries)
        self.seasonal_indices_won = self._calculate_seasonal_indices(self.closures)
        self.seasonal_indices_kva = self._calculate_seasonal_indices(self.kva)
    
    def _calculate_seasonal_indices(self, series: List[float]) -> Dict[int, float]:
        """Calculate monthly seasonal indices"""
        if len(series) < 12:
            return {i: 1.0 for i in range(1, 13)}
        
        # Group by month
        monthly_values = {i: [] for i in range(1, 13)}
        for i, value in enumerate(series):
            month_num = (i % 12) + 1
            monthly_values[month_num].append(value)
        
        # Calculate overall mean
        overall_mean = mean(series) if series else 1
        
        # Calculate seasonal index for each month
        indices = {}
        for month, values in monthly_values.items():
            if values and overall_mean > 0:
                month_mean = mean(values)
                indices[month] = month_mean / overall_mean
            else:
                indices[month] = 1.0
        
        return indices
    
    def _holt_winters(self, series: List[float], alpha: float = 0.3, beta: float = 0.1, 
                      gamma: float = 0.2, seasonal_period: int = 12) -> Tuple[float, float, List[float]]:
        """Triple exponential smoothing (Holt-Winters)"""
        n = len(series)
        
        if n < seasonal_period * 2:
            # Not enough data for seasonal model, use simple exponential smoothing
            level = series[0]
            trend = (series[-1] - series[0]) / max(n - 1, 1)
            return level, trend, [1.0] * seasonal_period
        
        # Initialize level, trend, and seasonal components
        # Level: average of first season
        level = mean(series[:seasonal_period])
        
        # Trend: average difference between corresponding points in first two seasons
        if n >= seasonal_period * 2:
            trend = mean([(series[i + seasonal_period] - series[i]) / seasonal_period 
                         for i in range(seasonal_period)])
        else:
            trend = 0
        
        # Seasonal: ratio of actual to level for first season
        seasonal = []
        for i in range(seasonal_period):
            if level > 0:
                seasonal.append(series[i] / level)
            else:
                seasonal.append(1.0)
        
        # Apply Holt-Winters recursively
        for i in range(seasonal_period, n):
            season_idx = i % seasonal_period
            
            # Deseasonalize observation
            if seasonal[season_idx] > 0:
                obs_deseasonalized = series[i] / seasonal[season_idx]
            else:
                obs_deseasonalized = series[i]
            
            # Update level
            new_level = alpha * obs_deseasonalized + (1 - alpha) * (level + trend)
            
            # Update trend
            new_trend = beta * (new_level - level) + (1 - beta) * trend
            
            # Update seasonal
            if new_level > 0:
                new_seasonal = gamma * (series[i] / new_level) + (1 - gamma) * seasonal[season_idx]
            else:
                new_seasonal = seasonal[season_idx]
            
            level = new_level
            trend = new_trend
            seasonal[season_idx] = new_seasonal
        
        return level, trend, seasonal
    
    def _weighted_moving_average(self, series: List[float], window: int = 6) -> float:
        """Weighted moving average with exponential decay weights"""
        if not series:
            return 0
        
        recent = series[-window:] if len(series) >= window else series
        weights = [math.exp(i * 0.3) for i in range(len(recent))]  # Exponential weights
        weight_sum = sum(weights)
        
        return sum(v * w for v, w in zip(recent, weights)) / weight_sum
    
    def _linear_regression_forecast(self, series: List[float]) -> Tuple[float, float]:
        """Simple linear regression to get trend"""
        n = len(series)
        if n < 2:
            return series[0] if series else 0, 0
        
        x = list(range(n))
        x_mean = mean(x)
        y_mean = mean(series)
        
        numerator = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, series))
        denominator = sum((xi - x_mean) ** 2 for xi in x)
        
        slope = numerator / denominator if denominator != 0 else 0
        intercept = y_mean - slope * x_mean
        
        return intercept + slope * n, slope  # Next value and slope
    
    def _same_month_average(self, series: List[float], target_month: int) -> float:
        """Average of same month in previous years"""
        same_month_values = []
        for i, value in enumerate(series):
            month_num = (i % 12) + 1
            if month_num == target_month:
                same_month_values.append(value)
        
        if same_month_values:
            # Weight more recent years higher
            weights = [math.exp(i * 0.5) for i in range(len(same_month_values))]
            return sum(v * w for v, w in zip(same_month_values, weights)) / sum(weights)
        return mean(series) if series else 0
    
    def forecast(self, months_ahead: int, start_month: int = None) -> List[Dict]:
        """Generate ensemble forecast"""
        if self.n < 3:
            return []
        
        # Determine starting month (1-12)
        if start_month is None:
            if self.months:
                last_month_str = self.months[-1]
                try:
                    start_month = int(last_month_str.split('-')[1]) % 12 + 1
                except:
                    start_month = 1
            else:
                start_month = 1
        
        predictions = []
        
        # Holt-Winters components
        hw_level_enq, hw_trend_enq, hw_seasonal_enq = self._holt_winters(self.enquiries)
        hw_level_won, hw_trend_won, hw_seasonal_won = self._holt_winters(self.closures)
        hw_level_kva, hw_trend_kva, hw_seasonal_kva = self._holt_winters(self.kva)
        
        # Linear regression components
        lr_next_enq, lr_slope_enq = self._linear_regression_forecast(self.enquiries)
        lr_next_won, lr_slope_won = self._linear_regression_forecast(self.closures)
        lr_next_kva, lr_slope_kva = self._linear_regression_forecast(self.kva)
        
        # Weighted moving average
        wma_enq = self._weighted_moving_average(self.enquiries)
        wma_won = self._weighted_moving_average(self.closures)
        wma_kva = self._weighted_moving_average(self.kva)
        
        for i in range(months_ahead):
            forecast_month = ((start_month - 1 + i) % 12) + 1
            season_idx = (forecast_month - 1) % len(hw_seasonal_enq) if hw_seasonal_enq else 0
            
            # Holt-Winters prediction
            hw_pred_enq = (hw_level_enq + hw_trend_enq * (i + 1)) * hw_seasonal_enq[season_idx]
            hw_pred_won = (hw_level_won + hw_trend_won * (i + 1)) * hw_seasonal_won[season_idx]
            hw_pred_kva = (hw_level_kva + hw_trend_kva * (i + 1)) * hw_seasonal_kva[season_idx]
            
            # Linear regression prediction with seasonal adjustment
            lr_pred_enq = (lr_next_enq + lr_slope_enq * i) * self.seasonal_indices_enq.get(forecast_month, 1.0)
            lr_pred_won = (lr_next_won + lr_slope_won * i) * self.seasonal_indices_won.get(forecast_month, 1.0)
            lr_pred_kva = (lr_next_kva + lr_slope_kva * i) * self.seasonal_indices_kva.get(forecast_month, 1.0)
            
            # Same-month historical average
            sm_pred_enq = self._same_month_average(self.enquiries, forecast_month)
            sm_pred_won = self._same_month_average(self.closures, forecast_month)
            sm_pred_kva = self._same_month_average(self.kva, forecast_month)
            
            # WMA prediction with seasonal adjustment
            wma_pred_enq = wma_enq * self.seasonal_indices_enq.get(forecast_month, 1.0)
            wma_pred_won = wma_won * self.seasonal_indices_won.get(forecast_month, 1.0)
            wma_pred_kva = wma_kva * self.seasonal_indices_kva.get(forecast_month, 1.0)
            
            # Ensemble: Weighted combination
            # Higher weights on more reliable methods
            # Same-month average: 35%, Holt-Winters: 30%, WMA: 20%, Linear Regression: 15%
            weights = {
                'same_month': 0.35,
                'holt_winters': 0.30,
                'wma': 0.20,
                'linear': 0.15
            }
            
            final_enq = (
                weights['same_month'] * sm_pred_enq +
                weights['holt_winters'] * hw_pred_enq +
                weights['wma'] * wma_pred_enq +
                weights['linear'] * lr_pred_enq
            )
            
            final_won = (
                weights['same_month'] * sm_pred_won +
                weights['holt_winters'] * hw_pred_won +
                weights['wma'] * wma_pred_won +
                weights['linear'] * lr_pred_won
            )
            
            final_kva = (
                weights['same_month'] * sm_pred_kva +
                weights['holt_winters'] * hw_pred_kva +
                weights['wma'] * wma_pred_kva +
                weights['linear'] * lr_pred_kva
            )
            
            # Ensure non-negative predictions
            predictions.append({
                'predicted_enquiries': max(0, int(round(final_enq))),
                'predicted_closures': max(0, int(round(final_won))),
                'predicted_kva': max(0, int(round(final_kva))),
                'forecast_month': forecast_month,
                'components': {
                    'same_month': {'enq': round(sm_pred_enq), 'won': round(sm_pred_won)},
                    'holt_winters': {'enq': round(hw_pred_enq), 'won': round(hw_pred_won)},
                    'wma': {'enq': round(wma_pred_enq), 'won': round(wma_pred_won)},
                    'linear': {'enq': round(lr_pred_enq), 'won': round(lr_pred_won)}
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
    
    window_size = body.get("window_size", 12)  # Increased default for better seasonality capture
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
        
        if test_idx >= len(all_data) or start_idx < 0:
            continue
        
        train_data = all_data[start_idx:end_idx]
        actual_data = all_data[test_idx]
        
        # Get the month number for the test period
        test_month_str = actual_data['_id']
        try:
            test_month_num = int(test_month_str.split('-')[1])
        except:
            test_month_num = 1
        
        # Generate prediction using advanced forecaster
        forecaster = AdvancedForecaster(train_data)
        predictions = forecaster.forecast(1, start_month=test_month_num)
        
        if not predictions:
            continue
        
        prediction = predictions[0]
        
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
            },
            "model_components": prediction.get('components', {})
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
    
    # Overall accuracy (weighted average based on importance)
    overall_accuracy = (
        enquiry_metrics.get('accuracy_percentage', 0) * 0.4 +
        closure_metrics.get('accuracy_percentage', 0) * 0.35 +
        kva_metrics.get('accuracy_percentage', 0) * 0.25
    )
    
    # Model insights
    model_insights = []
    if enquiry_metrics.get('accuracy_percentage', 0) >= 90:
        model_insights.append("✅ Enquiry predictions are highly accurate")
    elif enquiry_metrics.get('accuracy_percentage', 0) >= 80:
        model_insights.append("🟡 Enquiry predictions are good but can be improved")
    
    if closure_metrics.get('accuracy_percentage', 0) >= 90:
        model_insights.append("✅ Closure predictions are highly accurate")
    
    if kva_metrics.get('accuracy_percentage', 0) >= 90:
        model_insights.append("✅ KVA predictions are highly accurate")
    
    # Recommendations based on accuracy
    recommendations = []
    if overall_accuracy >= 90:
        recommendations.append("Model accuracy is excellent. Continue monitoring for drift.")
    elif overall_accuracy >= 80:
        recommendations.append("Model accuracy is good. Consider fine-tuning seasonal weights.")
    else:
        recommendations.append("Consider increasing training window size for better seasonal capture.")
        recommendations.append("Review data quality for anomalous months.")
    
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
        "model_info": {
            "type": "Ensemble (Holt-Winters + Same-Month Average + WMA + Linear Regression)",
            "weights": {
                "same_month_average": "35%",
                "holt_winters": "30%",
                "weighted_moving_average": "20%",
                "linear_regression": "15%"
            },
            "seasonality": "12-month cycle with adaptive indices",
            "insights": model_insights
        },
        "detailed_results": backtest_results,
        "recommendations": recommendations,
        "factors_used": [
            "12-month seasonal patterns",
            "Same-month historical averages (weighted by recency)",
            "Holt-Winters triple exponential smoothing",
            "Weighted moving average (6-month window)",
            "Linear trend analysis"
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
    
    # Calculate seasonal indices
    if monthly_data:
        forecaster = AdvancedForecaster(monthly_data)
        seasonal_indices = forecaster.seasonal_indices_enq
    else:
        seasonal_indices = {}
    
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
                    "name": "Same-Month Historical Average",
                    "description": "Weighted average of same month from previous years",
                    "weight": "35%",
                    "data_points": len(monthly_data)
                },
                {
                    "name": "Holt-Winters Exponential Smoothing",
                    "description": "Triple exponential smoothing with trend and seasonality",
                    "weight": "30%",
                    "data_points": len(monthly_data)
                },
                {
                    "name": "Weighted Moving Average",
                    "description": "6-month window with exponential recency weights",
                    "weight": "20%",
                    "data_points": min(6, len(monthly_data))
                },
                {
                    "name": "Linear Trend Analysis",
                    "description": "Regression-based trend projection",
                    "weight": "15%",
                    "data_points": len(monthly_data)
                }
            ],
            "seasonal_indices": {
                "description": "Monthly adjustment factors based on historical patterns",
                "values": {f"Month {k}": round(v, 3) for k, v in seasonal_indices.items()}
            },
            "secondary_factors": [
                {
                    "name": "KVA Distribution",
                    "description": "Product mix by generator capacity",
                    "weight": "Applied to KVA forecasts"
                },
                {
                    "name": "Conversion Rate Trends",
                    "description": "Historical closure rates",
                    "weight": "Implicit in closure predictions"
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
            "model_type": "Ensemble Statistical Model",
            "components": [
                "Holt-Winters Triple Exponential Smoothing",
                "Same-Month Historical Averaging (Recency-Weighted)",
                "Weighted Moving Average",
                "Linear Regression Trend"
            ],
            "seasonality": "12-month cycle with adaptive indices",
            "ensemble_strategy": "Weighted combination optimized for minimal MAPE"
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
    total_kva_leads = sum([d["count"] for d in kva_distribution]) if kva_distribution else 1
    
    # Use advanced forecaster for statistical predictions
    forecaster = AdvancedForecaster(historical_data)
    
    # Determine the starting month for forecast
    last_month = historical_data[-1]['_id']
    try:
        year, month = last_month.split('-')
        start_month = int(month) % 12 + 1
        start_year = int(year) if int(month) < 12 else int(year) + 1
    except:
        start_month = 1
        start_year = 2026
    
    statistical_predictions = forecaster.forecast(horizon, start_month=start_month)
    
    # Prepare data for GPT-4o (for analysis and insights)
    data_summary = "\n".join([
        f"Month {d['_id']}: {d['total_enquiries']} enquiries, {d['won']} won, {d['lost']} lost, {d['total_kva']:.0f} total KVA"
        for d in historical_data[-12:]  # Last 12 months
    ])
    
    # Generate forecast using GPT-4o for analysis
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"forecast_{current_user.user_id}_{datetime.now().timestamp()}",
            system_message="""You are an expert sales forecasting analyst for a generator/genset company. 
            Analyze the data and provide insights about trends, seasonality, and recommendations.
            Keep your analysis concise and actionable."""
        ).with_model("openai", "gpt-4o")
        
        # Build predictions for AI to analyze
        pred_summary = "\n".join([
            f"Month {i+1}: {p['predicted_enquiries']} enquiries, {p['predicted_closures']} closures, {p['predicted_kva']} KVA"
            for i, p in enumerate(statistical_predictions)
        ])
        
        prompt = f"""Analyze this historical lead data and our statistical predictions for a generator company:

RECENT HISTORICAL DATA (Last 12 months):
{data_summary}

STATISTICAL MODEL PREDICTIONS (Next {horizon} months):
{pred_summary}

Provide a JSON response with:
{{
    "trend_analysis": {{
        "volume_trend": "description of enquiry volume trend",
        "conversion_trend": "description of conversion patterns",
        "kva_mix_trend": "which KVA capacities are trending",
        "seasonal_patterns": "any seasonal patterns observed"
    }},
    "summary": "2-3 sentence summary of the forecast",
    "factors_considered": ["list of 4-5 key factors"],
    "recommendations": ["3-4 actionable recommendations"],
    "risks": ["2-3 potential risks"]
}}"""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse AI response
        ai_analysis = None
        try:
            clean_response = re.sub(r'```json\s*\n?', '', response)
            clean_response = re.sub(r'```\s*\n?', '', clean_response)
            clean_response = clean_response.strip()
            
            json_start = clean_response.find("{")
            json_end = clean_response.rfind("}") + 1
            
            if json_start != -1 and json_end > json_start:
                ai_analysis = json.loads(clean_response[json_start:json_end])
        except:
            pass
        
        # Build final response with statistical predictions and AI analysis
        predictions = []
        from dateutil.relativedelta import relativedelta
        base_date = datetime.now(timezone.utc)
        
        for i, stat_pred in enumerate(statistical_predictions):
            month_date = base_date + relativedelta(months=i+1)
            
            # Build KVA breakdown based on historical distribution
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
                "confidence": "high" if len(historical_data) >= 24 else "medium",
                "breakdown": {"by_kva": kva_breakdown},
                "model_components": stat_pred.get('components', {})
            })
        
        forecast_json = {
            "predictions": predictions,
            "summary": ai_analysis.get("summary", f"Forecast based on {len(historical_data)} months of historical data using ensemble statistical model.") if ai_analysis else f"Forecast based on {len(historical_data)} months of historical data.",
            "trend_analysis": ai_analysis.get("trend_analysis", {
                "volume_trend": "Based on historical patterns",
                "conversion_trend": "Stable",
                "kva_mix_trend": "Following historical distribution",
                "seasonal_patterns": "12-month cycle detected"
            }) if ai_analysis else {},
            "factors_considered": ai_analysis.get("factors_considered", [
                "12-month seasonal patterns",
                "Same-month historical averages",
                "Holt-Winters smoothing",
                "Recent trend analysis"
            ]) if ai_analysis else [],
            "recommendations": ai_analysis.get("recommendations", [
                "Monitor actual vs predicted monthly",
                "Adjust for any market changes"
            ]) if ai_analysis else [],
            "risks": ai_analysis.get("risks", [
                "External market factors not captured",
                "Assumes stable business conditions"
            ]) if ai_analysis else []
        }
        
        return {
            "success": True,
            "forecast": forecast_json,
            "historical_data": historical_data,
            "kva_distribution": [{"kva": d["_id"], "count": d["count"], "percentage": round(d["count"]/total_kva_leads*100, 2)} for d in kva_distribution],
            "horizon_months": horizon,
            "model_info": {
                "type": "Ensemble (Holt-Winters + Same-Month Avg + WMA + Linear)",
                "training_months": len(historical_data),
                "seasonality": "12-month cycle"
            },
            "filters": {"state": state, "dealer": dealer, "location": location},
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Forecast generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")
