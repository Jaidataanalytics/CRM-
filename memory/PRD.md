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

### 3. AI-Powered Forecasting (NEW - Jan 5, 2026)
- **KVA-wise Breakdown**: Forecast predictions include all 34 KVA product categories
- **Split Testing/Backtesting**: Rolling window validation of forecast accuracy
- **Accuracy Metrics**: MAPE, MAE, RMSE, R², Direction Accuracy
- **Factors Documentation**: Transparency into what drives predictions

### 4. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key

## Data Model - Key Fields
- `kva`: Generator capacity (5-750 KVA range, 34 unique values)
- `enquiry_type`: Hot/Warm/Cold classification
- `enquiry_status`: Open/Closed
- `enquiry_stage`: Prospecting/Closed-Won/Closed-Lost
- `followup_history`: Array of follow-up records

## KVA Product Categories (from actual data)
| Category | KVA Values | Lead Share |
|----------|------------|------------|
| Small | 5, 7.5, 10, 12.5, 15 | 23.6% |
| Medium | 18.5-50 | 44.5% |
| Large | 55-125 | 25.6% |
| Industrial | 140-750 | 6.3% |

## Completed Work (Jan 5, 2026)

### Session Tasks
1. ✅ KVA-wise breakdown for forecasting - Shows all 34 KVA products
2. ✅ Documented forecast factors - New "Factors" tab showing what drives predictions
3. ✅ Split test/backtest on historical data - Rolling window with 12 test periods
4. ✅ All accuracy metrics - MAPE, MAE, RMSE, R², Direction Accuracy

### Backtest Results Summary
- **Overall Accuracy**: ~48.67%
- **KVA Predictions**: 77.9% accuracy (best performer)
- **Closure Predictions**: 68.1% accuracy
- **Enquiry Volume**: Needs improvement (high variance)

## API Endpoints

### Forecast Module
- `POST /api/forecast` - Generate AI forecast with KVA breakdown
- `POST /api/forecast/backtest` - Run rolling window accuracy test
- `GET /api/forecast/factors` - Get all forecast factors and data quality

## Known Limitations
1. Enquiry volume predictions show high variance (MAPE > 2000%)
2. Direction accuracy is low (~27%) for volume predictions
3. Model explains only 4% of variance in enquiry predictions

## Improvement Recommendations
1. Add explicit seasonality indices
2. Incorporate external market events
3. Weight predictions by KVA category trends
4. Factor in Hot/Warm/Cold lead ratios
5. Build state-specific forecast models

## Upcoming Tasks
- User verification of deployment fix (recurring issue)
- Detailed audit logs (postponed by user)
- UX/UI improvements

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
