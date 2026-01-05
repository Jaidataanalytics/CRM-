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
- **Multi-Dimensional Breakdowns**:
  - KVA-wise (34 products) with predicted closures & conversion rates
  - State-wise (18 states) with predicted closures & conversion rates
  - Dealer-wise (20 dealers) with predicted closures & conversion rates
  - Employee-wise with predicted closures & conversion rates
  - Segment-wise (22 segments) with predicted closures & conversion rates
- **Consistent Closure Totals** (NEW): All breakdowns now show the SAME total closures
- **Source of Truth Selection** (NEW): System automatically selects the most accurate dimension
- **Business Context Adjustments**:
  - Marketing Effort (same/increasing/decreasing with intensity slider)
  - Promotional Campaigns (none/minor +10%/major +25%)
  - Market Conditions (challenging -10%/stable/growing +15%)
  - Expected Demand (low -15%/normal/high +20%)
- **Split Testing/Backtesting**: Rolling window validation
- **Accuracy Metrics**: MAPE, WMAPE, MAE, RMSE, R², Direction Accuracy
- **Save & View Projections**: Save forecasts for future reference

### 4. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key

## Key API Endpoints

### Forecast Module
- `POST /api/forecast` - Generate forecast with all breakdowns including closures
- `POST /api/forecast/backtest` - Run rolling window accuracy test
- `GET /api/forecast/factors` - Get all forecast factors and data quality
- `POST /api/forecast/save` - Save a generated forecast
- `GET /api/forecast/saved` - Get list of saved forecasts
- `DELETE /api/forecast/saved/{index}` - Delete a saved forecast

### Forecast Response Structure (Updated)
```json
{
  "success": true,
  "source_of_truth": {
    "dimension": "State",
    "accuracy": 53.4,
    "conversion_rate": 24.8,
    "explanation": "Predictions based on: State Breakdown (53.4% accuracy)"
  },
  "dimension_accuracies": [
    {"dimension": "KVA", "accuracy": 50.8},
    {"dimension": "State", "accuracy": 53.4},
    {"dimension": "Dealer", "accuracy": 53.4},
    {"dimension": "Employee", "accuracy": 0},
    {"dimension": "Segment", "accuracy": 53.4}
  ],
  "forecast": {
    "predictions": [
      {
        "month": "2026-02",
        "predicted_enquiries": 360,
        "predicted_closures": 89,
        "breakdown": {
          "by_kva": [...],  // Sum of closures = 89
          "by_state": [...],  // Sum of closures = 89
          "by_dealer": [...],  // Sum of closures = 89
          "by_employee": [...],  // Sum of closures = 89
          "by_segment": [...]  // Sum of closures = 89
        }
      }
    ]
  }
}
```

## Completed Work (Jan 5, 2026)

### Session 2 - COMPLETED
1. ✅ **Closure Consistency Fix**: All breakdown totals (KVA, State, Dealer, Employee, Segment) now equal monthly total
2. ✅ **Dimension Accuracy Calculation**: System calculates historical accuracy for each dimension
3. ✅ **Source of Truth Selection**: Automatically selects dimension with highest accuracy
4. ✅ **Master Closure Distribution**: Uses winning dimension's conversion rate for consistent predictions
5. ✅ **UI: Source of Truth Card**: Shows winning dimension, accuracy, and comparison of all dimensions
6. ✅ All tests passed (14/14 backend, frontend verified)

### Session 1 - COMPLETED
1. ✅ Predicted closures added to all breakdown tables
2. ✅ Conversion rates displayed in all breakdown tables
3. ✅ "Save Projection" button added
4. ✅ "Saved Projections" tab added

## Upcoming Tasks
- **Compare Projections (P1)**: Compare two saved forecasts side by side

## Future/Backlog Tasks
- Detailed audit logs (P2 - postponed by user)
- UX/UI Improvement suggestions (P2)
- Refactor Forecast.js into smaller components

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
