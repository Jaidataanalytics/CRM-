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
- **KVA-wise Breakdown**: Forecast predictions include all 34 KVA product categories
- **Split Testing/Backtesting**: Rolling window validation of forecast accuracy
- **Accuracy Metrics**: MAPE, WMAPE, MAE, RMSE, R², Direction Accuracy
- **Business Context Adjustments (NEW)**:
  - Marketing Effort (same/increasing/decreasing with intensity slider)
  - Promotional Campaigns (none/minor +10%/major +25%)
  - Market Conditions (challenging -10%/stable/growing +15%)
  - Expected Demand (low -15%/normal/high +20%)
- Combined adjustments calculate compound multiplier for predictions

### 4. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key

## Forecast Model Details

### Model Type
Adaptive Seasonal Forecaster with Business Context Adjustments

### Prediction Method
- Uses same calendar month historical values with recency weighting
- 2 years: 70% recent, 30% older
- 3 years: 50%/30%/20% weighting
- 4+ years: Exponential decay on recent 3 years

### Business Adjustment Multipliers
| Factor | Options | Impact |
|--------|---------|--------|
| Marketing Effort | Increasing | +0% to +30% (based on intensity) |
| Marketing Effort | Decreasing | -0% to -20% (based on intensity) |
| Campaign | Minor | +10% |
| Campaign | Major | +25% |
| Market | Challenging | -10% |
| Market | Growing | +15% |
| Demand | Low | -15% |
| Demand | High | +20% |

### Backtest Results (Current)
- **Enquiries**: 76.8% accuracy (WMAPE: 23.2%)
- **KVA**: 80.6% accuracy
- **Closures**: 58.1% accuracy
- **75% of predictions within ±30%**

### Data Characteristics
- 44 complete months of data (Apr 2022 - Nov 2025)
- 20-30% coefficient of variation by month
- 24% YoY growth between 2024-2025

## KVA Product Categories (34 unique values)
| Category | KVA Values | Lead Share |
|----------|------------|------------|
| Small | 5, 7.5, 10, 12.5, 15 | 23.6% |
| Medium | 18.5-50 | 44.5% |
| Large | 55-125 | 25.6% |
| Industrial | 140-750 | 6.3% |

## Key API Endpoints

### Forecast Module
- `POST /api/forecast` - Generate forecast with business context adjustments
- `POST /api/forecast/backtest` - Run rolling window accuracy test
- `GET /api/forecast/factors` - Get all forecast factors and data quality

### Request Body for Forecast
```json
{
  "horizon": 3,
  "business_context": {
    "marketing_effort": "increasing",
    "marketing_intensity": 50,
    "campaign_type": "major",
    "market_conditions": "growing",
    "seasonal_factor": "normal"
  }
}
```

## Completed Work (Jan 5, 2026)

### This Session
1. ✅ KVA-wise breakdown for forecasting - All 34 KVA products
2. ✅ Documented forecast factors - "Factors" tab
3. ✅ Split test/backtest - Rolling window with 12 test periods
4. ✅ All accuracy metrics - MAPE, WMAPE, MAE, RMSE, R², Direction
5. ✅ **Business Context Adjustments** - Marketing, Campaigns, Market conditions, Demand

### Previous Session
- KPI logic correction
- Advanced filters
- Follow-up tracking system
- Clickable KPI cards & global search
- Location field, default sorting, form validation
- Critical deployment fix

## Upcoming Tasks
- User verification of deployment fix (P0)
- Detailed audit logs (P2 - postponed by user)

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
