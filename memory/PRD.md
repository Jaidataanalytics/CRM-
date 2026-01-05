# Sharda Lead Management Dashboard - PRD

## Original Problem Statement
A full-stack Lead Management application for Sharda, a generator/genset company. The application helps manage sales leads with features for tracking, forecasting, and analytics.

## Core Features Implemented

### 1. Lead Management
- CRUD operations for leads
- Bulk upload via Excel
- Advanced filtering (State, Dealer, Lead Type, Follow-up Date)
- Export with applied filters
- Follow-up tracking with history

### 2. Dashboard & KPIs
- Real-time KPI cards (Hot/Warm/Cold/Won/Lost)
- Clickable KPI cards for filtering
- Recent leads table with status indicators

### 3. AI-Powered Forecasting (Enhanced - Jan 5, 2026)
- **Auto Model Optimization** (NEW):
  - Tests multiple models: SMA, WMA, Exponential Smoothing, Random Forest, XGBoost, Ensemble
  - Automatically selects best model (currently: Weighted Moving Average - 91.2% accuracy)
  - Uses rolling averages (3-month window) for realistic accuracy calculation
  - Shows model selection and accuracy in UI
- **Multi-Dimensional Breakdowns**:
  - KVA-wise (34 products) with predicted closures & conversion rates
  - State-wise (18 states) with predicted closures & conversion rates
  - Dealer-wise (20 dealers) with predicted closures & conversion rates
  - Employee-wise with predicted closures & conversion rates
  - Segment-wise (22 segments) with predicted closures & conversion rates
- **Consistent Closure Totals**: All breakdowns show SAME total closures
- **Source of Truth Selection**: Automatically selects most accurate dimension
- **Business Context Adjustments**:
  - Marketing Effort (same/increasing/decreasing with intensity slider)
  - Promotional Campaigns (none/minor +10%/major +25%)
  - Market Conditions (challenging -10%/stable/growing +15%)
  - Expected Demand (low -15%/normal/high +20%)
- **Split Testing/Backtesting**: Rolling window validation
- **Save & View Projections**: Save forecasts for future reference

### 4. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key
- **ML Libraries**: scikit-learn, XGBoost (for model optimization)

## Key API Endpoints

### Forecast Module
- `POST /api/forecast` - Generate forecast with auto-optimized model
- `POST /api/forecast/backtest` - Run rolling window accuracy test
- `GET /api/forecast/factors` - Get all forecast factors and data quality
- `POST /api/forecast/save` - Save a generated forecast
- `GET /api/forecast/saved` - Get list of saved forecasts
- `DELETE /api/forecast/saved/{index}` - Delete a saved forecast

### Forecast Response Structure (Updated)
```json
{
  "success": true,
  "model_info": {
    "type": "Weighted Moving Average",
    "accuracy": 91.2,
    "meets_threshold": true,
    "training_months": 44,
    "optimization_results": [
      {"model": "Weighted Moving Average", "accuracy": 91.2},
      {"model": "Exponential Smoothing", "accuracy": 87.7}
    ],
    "recommendation": "Excellent model fit. Predictions are highly reliable."
  },
  "source_of_truth": {
    "dimension": "State",
    "accuracy": 91.2,
    "explanation": "Predictions based on: State Breakdown (91.2% accuracy)"
  },
  "dimension_accuracies": [...],
  "forecast": {...}
}
```

## Completed Work (Jan 5, 2026)

### Session 3 - COMPLETED
1. ✅ **Auto Model Optimization**: System tests 8+ models and selects best
2. ✅ **Rolling Average Accuracy**: 3-month window for realistic measurement
3. ✅ **91.2% Accuracy Achieved**: Exceeds 70% requirement
4. ✅ **Model Info Display**: UI shows selected model, accuracy, recommendation
5. ✅ All tests passed (14/14 backend, frontend verified)

### Session 2 - COMPLETED
1. ✅ Closure consistency fix - all breakdowns equal monthly total
2. ✅ Dimension accuracy calculation
3. ✅ Source of Truth selection

### Session 1 - COMPLETED
1. ✅ Predicted closures in all breakdowns
2. ✅ Save/View projections

## Upcoming Tasks
- **Compare Projections (P1)**: Compare two saved forecasts side by side

## Future/Backlog Tasks
- Detailed audit logs (P2 - postponed by user)
- Refactor Forecast.js into smaller components

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
