# Sharda Lead Management Dashboard - PRD

## Original Problem Statement
A full-stack Lead Management application for Sharda, a generator/genset company. The application helps manage sales leads with features for tracking, forecasting, analytics, and dispatch management.

## Core Features Implemented

### 1. Lead Management
- CRUD operations for leads
- Bulk upload via Excel (uses enquiry_no + phone_number composite key)
- Advanced filtering (State, Dealer, Lead Type, Follow-up Date)
- Export with applied filters
- Follow-up tracking with history
- **Lost Lead Questions**: Optional closure questions when lead is marked as Lost (shows "Pending" until filled)

### 2. Dashboard & KPIs
- Real-time KPI cards (Hot/Warm/Cold/Won/Lost)
- **Dispatch KPIs**: Pending Dispatch, Dispatched counts
- Clickable KPI cards for filtering
- Recent leads table with status indicators

### 3. Dispatch Management
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
- **Compare Forecasts**: Compare saved projections against actual results (NEW - Jan 5, 2026)

### 6. Analytics & Insights (Admin/Manager only)
- **Top Performers**: By Employee, Dealer, State
- **Conversion Analysis**: Conversion rate vs follow-ups
- **Segment Analysis**: Performance by segment
- **Closure Analysis** (NEW - Jan 5, 2026):
  - Summary cards: Total Lost, With Closure Data, Pending, Completion Rate
  - Question-by-question breakdown with answer distribution
  - Lost leads by State and Dealer
  - Helps identify patterns in why leads are lost
- Role-based access (Admin, Manager, Employee)
- Google OAuth via Emergent-managed Auth
- Activity logging

## Technical Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Chart.js + Recharts
- **Backend**: FastAPI + MongoDB
- **AI**: GPT-4o via Emergent LLM Key
- **ML Libraries**: scikit-learn, XGBoost, statsmodels, Prophet

## Key API Endpoints

### Dispatch Module
- `GET /api/dispatch/summary` - Get pending/dispatched counts
- `GET /api/dispatch/list` - List won orders with dispatch status
- `PATCH /api/dispatch/{lead_id}` - Update dispatch status
- `GET /api/dispatch/{lead_id}/history` - Dispatch change history
- `POST /api/dispatch/migrate` - Migrate existing data (admin only)

### Forecast Module
- `POST /api/forecast` - Generate forecast with auto-optimized model
- `POST /api/forecast/save` - Save a generated forecast
- `GET /api/forecast/saved` - Get list of saved forecasts
- `GET /api/forecast/compare/{index}` - Compare saved forecast with actual results (NEW)

### Closure Questions Module (NEW)
- `GET /api/leads/pending-closure-questions/count` - Count leads needing closure questions
- `GET /api/leads/pending-closure-questions` - List leads needing closure questions
- `POST /api/leads/{lead_id}/closure-answers` - Save closure question answers
- `GET /api/admin/closure-questions` - Get configured closure questions

## Completed Work

### Session 5 - Jan 5, 2026 (COMPLETED)
1. ✅ **Compare Forecasts Page**:
   - New page at /compare-forecasts
   - Select saved forecast from dropdown
   - Compare button triggers comparison
   - Monthly comparison table with predicted vs actual
   - KVA, State, Dealer breakdown tabs
   - Accuracy metrics (Overall, Leads, Closures, KVA)
   - Charts showing Predicted vs Actual
2. ✅ **Lost Lead Questions**:
   - Modal triggers when lead status changes to Lost
   - Optional answers (shows "Pending" until filled)
   - Backend endpoints for closure answers
   - Pending count shown in Leads page header
3. ✅ **Upload Composite Key Logic**:
   - Uses enquiry_no + phone_number to identify existing leads
   - Updates existing leads, creates new ones if not found
4. ✅ All tests passed (12/12 backend, frontend verified)

### Session 4 - COMPLETED
1. ✅ **Dispatch Management Feature**
2. ✅ **KPI Cards**: Added Pending Dispatch and Dispatched to Dashboard
3. ✅ **Migration**: Dispatch status for historical orders

### Previous Sessions - COMPLETED
- Auto Model Optimization (91.2% accuracy)
- Per-Dimension Accuracy (all ≥75%)
- Closure consistency fix
- Save/View projections

## Future/Backlog Tasks
- Detailed audit logs (P2)
- Refactor Forecast.js into smaller components (P2)

## Credentials
- **Admin**: admin / admin123
- **Employee**: employee@test.com / testpassword
