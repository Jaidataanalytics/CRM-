# Sharda Lead Management Dashboard - PRD

## Original Problem Statement
A full-stack Lead Management application for Sharda, a generator/genset company. The application helps manage sales leads with features for tracking, forecasting, analytics, and dispatch management.

## Core Features Implemented

### 1. Lead Management
- CRUD operations for leads
- Bulk upload via Excel
- Advanced filtering (State, Dealer, Lead Type, Follow-up Date)
- Export with applied filters
- Follow-up tracking with history

### 2. Dashboard & KPIs
- Real-time KPI cards (Hot/Warm/Cold/Won/Lost)
- **Dispatch KPIs**: Pending Dispatch, Dispatched counts (NEW)
- Clickable KPI cards for filtering
- Recent leads table with status indicators

### 3. Dispatch Management (NEW - Jan 5, 2026)
- **Dedicated Dispatch Page**: Track and manage order dispatches
- **Status Tracking**: Pending Dispatch → Dispatched
- **Historical Data Handling**: 
  - Orders won before Jan 5, 2026 = "Dispatched" by default (no date)
  - Orders won on/after Jan 5, 2026 = "Pending Dispatch" by default
- **Dispatch Fields**: Dispatch date, delivery address, transporter details
- **Validation**: Dispatch date cannot be before won date
- **Status Change Rules**:
  - Historical orders: Can change without reason
  - New orders: Reason required when changing dispatched → pending
- **Dispatch History**: Full audit trail of status changes

### 4. AI-Powered Forecasting (Enhanced)
- **Auto Model Optimization**: Tests 8+ models, selects best
- **91.2% Accuracy Achieved**: Using Weighted Moving Average
- **Per-Dimension Accuracy**: All dimensions ≥75%
- **Multi-Dimensional Breakdowns**: KVA, State, Dealer, Employee, Segment
- **Consistent Closure Totals**: All breakdowns equal monthly total
- **Business Context Adjustments**
- **Save & View Projections**

### 5. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key
- **ML Libraries**: scikit-learn, XGBoost, statsmodels, Prophet

## Key API Endpoints

### Dispatch Module (NEW)
- `GET /api/dispatch/summary` - Get pending/dispatched counts
- `GET /api/dispatch/list` - List won orders with dispatch status
- `PATCH /api/dispatch/{lead_id}` - Update dispatch status
- `GET /api/dispatch/{lead_id}/history` - Dispatch change history
- `POST /api/dispatch/migrate` - Migrate existing data (admin only)

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
