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
  - KVA-wise (34 products)
  - State-wise (18 states)
  - Dealer-wise (20 dealers)
  - Employee-wise
  - Segment-wise (22 segments)
- **Business Context Adjustments**:
  - Marketing Effort (same/increasing/decreasing with intensity slider)
  - Promotional Campaigns (none/minor +10%/major +25%)
  - Market Conditions (challenging -10%/stable/growing +15%)
  - Expected Demand (low -15%/normal/high +20%)
- **Split Testing/Backtesting**: Rolling window validation
- **Accuracy Metrics**: MAPE, WMAPE, MAE, RMSE, R², Direction Accuracy

### 4. User Management
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key

## Forecast Breakdown Details

### KVA Distribution (34 products)
| Category | KVA Values | Lead Share |
|----------|------------|------------|
| Small | 5, 7.5, 10, 12.5, 15 | 23.6% |
| Medium | 18.5-50 | 44.5% |
| Large | 55-125 | 25.6% |
| Industrial | 140-750 | 6.3% |

### State Distribution (Top 5)
| State | Lead Share |
|-------|------------|
| Bihar | 46.1% |
| Jharkhand | 31.5% |
| Chhattisgarh | 19.8% |
| Punjab | 0.6% |
| Others | 1.0% |

### Segment Distribution (Top 5)
| Segment | Lead Share |
|---------|------------|
| Rental | 26.2% |
| Real Estate-Residential | 10.6% |
| Real Estate-Commercial | 10.6% |
| Government And Tenders | 6.8% |
| Health Care | 6.5% |

## Business Adjustment Multipliers
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

## Key API Endpoints

### Forecast Module
- `POST /api/forecast` - Generate forecast with all breakdowns
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

### Response Includes
- Monthly predictions with all breakdowns (KVA, State, Dealer, Employee, Segment)
- Historical distributions for reference
- Business adjustment details
- AI-generated trend analysis

## Completed Work (Jan 5, 2026)

### This Session
1. ✅ KVA-wise breakdown for forecasting
2. ✅ **State-wise breakdown** - NEW
3. ✅ **Dealer-wise breakdown** - NEW
4. ✅ **Employee-wise breakdown** - NEW
5. ✅ **Segment-wise breakdown** - NEW
6. ✅ Business Context Adjustments
7. ✅ Split test/backtest with accuracy metrics

## Upcoming Tasks
- User verification of deployment fix (P0)
- Detailed audit logs (P2 - postponed by user)

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
