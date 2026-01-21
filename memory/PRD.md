# Sharda Leads Dashboard - Product Requirements Document

## Original Problem Statement
Build a comprehensive leads management dashboard for tracking sales leads, forecasting, and analytics with features for:
- Lead management with deduplication
- Sales forecasting with KVA breakdown
- Multi-dimensional analytics (Segment, Source, KVA, Closure)
- Market potential comparison
- Year-over-Year analysis

## User Personas
- **Admin**: Full access to all features, data management, cleanup tools
- **Manager**: Access to forecasts, analytics, lead management
- **Sales Staff**: Basic lead viewing and updates

## Core Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── kpis.py              # Dashboard KPIs with KVA breakdown
│   │   ├── insights.py          # All analytics endpoints (Segment, Source, KVA, Temperature, Lead Age)
│   │   ├── market_potential.py  # Comparison page data
│   │   ├── forecast.py          # Forecasting with complete data saving
│   │   └── leads.py             # Lead management + duplicate analytics
│   └── server.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.js      # KVA breakdown cards (LKVA/MKVA/HKVA)
        │   ├── Insights.js       # All analysis tabs + Summary Builder
        │   ├── Comparison.js     # Market potential analysis
        │   ├── DuplicateLeads.js # Data quality + Analytics tab
        │   └── CompareForecasts.js # Saved forecast details view
        ├── context/
        │   └── FilterContext.js  # Global filters including maxLeadAge
        └── components/
            └── filters/
                └── FilterBar.js  # Filter bar with lead age slider
```

## What's Been Implemented (as of Jan 2026)

### Dashboard
- [x] KPI cards with LKVA/MKVA/HKVA breakdown
- [x] Hot/Warm/Cold leads summary
- [x] Quick actions and recent activity

### Insights Page
- [x] Top Performers tab
- [x] Segment Analysis with YoY toggle
- [x] Closure Analysis with YoY toggle
- [x] Source Analysis with YoY toggle
- [x] KVA Analysis with YoY toggle
- [x] **Hot/Warm/Cold Analysis** (NEW) - Temperature distribution by dimension
- [x] **Lead Age Analysis** (NEW) - Average lead age by dimension
- [x] Summary Builder with KVA dimension + Financial Year format
- [x] Multi-level drill-down (Category → Dealer → District → Employee)

### Comparison Page
- [x] Market potential data upload via Excel
- [x] Comparison by District, Dealer, State, KVA Range
- [x] Uses actual `district` field (not `location`)
- [x] Indian Financial Year date logic

### Global Filters
- [x] Date range (Indian FY default)
- [x] State, Dealer, Employee, Segment
- [x] KVA Min/Max
- [x] **Max Lead Age slider** (NEW) - Filter out leads older than X days

### Forecasting
- [x] Adaptive seasonal forecasting model
- [x] KVA, Dealer, Segment breakdowns
- [x] Backtest functionality
- [x] **Complete forecast saving** (NEW) - Saves all breakdowns, notes, summary
- [x] **Saved forecast details view** (NEW) - View breakdown on Compare Forecasts page

### Data Management
- [x] Duplicate leads detection
- [x] Merge history
- [x] Order time punch detection
- [x] Won without SO detection
- [x] **Analytics tab** (NEW) - Duplicates/merges by dimension
- [x] Clickable leads in merge history

### Terminology Updates
- [x] Changed "Location" to "District" everywhere
- [x] Uses actual `district` column from lead data

## Prioritized Backlog

### P0 - Critical
None currently

### P1 - High Priority
1. **Funnel Analysis** - Conversion rates: Enquiry → Quotation → Won
2. **Manual 'Qualified' Toggle** - UI to set lead's `is_qualified` status

### P2 - Medium Priority
1. **Refactor Large Components** - Break down Insights.js (~2500 lines), Admin.js (~3000 lines)
2. **Lead Velocity & ROI Analysis** - How fast leads move through stages
3. **Dashboard customization** - User-configurable widgets
4. **Export to Excel** - All pages

### P3 - Low Priority
1. **Verify Per-Dimension Forecast Accuracy**
2. **Detailed Audit Logs**

## Key Technical Notes

### Financial Year Logic
- Indian FY: April 1 - March 31
- Quarterly: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
- Format: "FY2025-26" for yearly, "2025-26-Q1" for quarterly

### Hot/Warm/Cold Classification
- Based on `enquiry_type` field (not `enquiry_stage`)
- Hot, Warm, Cold values from lead data

### MongoDB Considerations
- Always exclude `_id` from responses or convert to string
- Use `deleted_at: {"$exists": False}` for soft-deleted leads
- Use `is_duplicate: False` filter where applicable

## Credentials for Testing
- Username: `admin`
- Password: `admin123`

## Known Issues
- Frontend build folder may disappear - fix: `yarn build && sudo supervisorctl restart frontend`
