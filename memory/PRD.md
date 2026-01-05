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
- `POST /api/forecast/save` - Save a generated forecast
- `GET /api/forecast/saved` - Get list of saved forecasts

## Completed Work (Jan 5, 2026)

### Session 4 - COMPLETED
1. ✅ **Dispatch Management Feature**:
   - New Dispatch page in sidebar
   - Summary cards: Total Won (2606), Pending (9), Dispatched (2597)
   - Tabs: Pending, Dispatched, All
   - Dispatch modal with date, address, transporter fields
   - Date validation (cannot be before won date)
   - Reason required for status reversion (new orders only)
   - Dispatch history tracking
2. ✅ **KPI Cards**: Added Pending Dispatch and Dispatched to Dashboard
3. ✅ **Migration**: Automatically set dispatch status for 4110 existing won orders
4. ✅ All tests passed (15/15 backend, frontend verified)

### Previous Sessions - COMPLETED
- Auto Model Optimization (91.2% accuracy)
- Per-Dimension Accuracy (all ≥75%)
- Closure consistency fix
- Save/View projections

## Upcoming Tasks
- **Compare Projections (P1)**: Compare two saved forecasts side by side

## Future/Backlog Tasks
- Detailed audit logs (P2 - postponed by user)
- Refactor Forecast.js into smaller components

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
