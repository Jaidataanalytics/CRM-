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
- **Business Context Adjustments**:
  - Marketing Effort (same/increasing/decreasing with intensity slider)
  - Promotional Campaigns (none/minor +10%/major +25%)
  - Market Conditions (challenging -10%/stable/growing +15%)
  - Expected Demand (low -15%/normal/high +20%)
- **Split Testing/Backtesting**: Rolling window validation
- **Accuracy Metrics**: MAPE, WMAPE, MAE, RMSE, R², Direction Accuracy
- **Save & View Projections**: Save forecasts for future reference (NEW Jan 5, 2026)

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
- `POST /api/forecast/save` - Save a generated forecast (NEW)
- `GET /api/forecast/saved` - Get list of saved forecasts (NEW)
- `DELETE /api/forecast/saved/{index}` - Delete a saved forecast (NEW)

### Forecast Response Structure
Each breakdown item now includes:
- `predicted_leads` - Number of predicted leads
- `predicted_closures_category` - Category-specific predicted closures
- `conversion_rate` - Historical conversion rate for that category (%)

## Completed Work (Jan 5, 2026)

### This Session - COMPLETED
1. ✅ Predicted closures added to all breakdown tables (KVA, State, Dealer, Employee, Segment)
2. ✅ Conversion rates displayed in all breakdown tables
3. ✅ "Save Projection" button added (green, appears after forecast generation)
4. ✅ "Saved Projections" tab added to view saved forecasts
5. ✅ Backend endpoints for saving/listing/deleting forecasts
6. ✅ All tests passed (15/15 backend tests)

### Previously Completed
1. ✅ KVA-wise breakdown for forecasting
2. ✅ State-wise breakdown
3. ✅ Dealer-wise breakdown
4. ✅ Employee-wise breakdown
5. ✅ Segment-wise breakdown
6. ✅ Business Context Adjustments
7. ✅ Split test/backtest with accuracy metrics

## Upcoming Tasks
- **View Saved Projections Detail** (P1): Expand saved projection to show detailed breakdowns
- **Compare Projections** (P2): Compare two saved forecasts side by side

## Future/Backlog Tasks
- Detailed audit logs (P2 - postponed by user)
- UX/UI Improvement suggestions (P2)
- Refactor Forecast.js into smaller components

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
