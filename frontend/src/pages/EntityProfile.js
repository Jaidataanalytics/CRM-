import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { 
  MapPin, Building2, User, Users, Target, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, AlertTriangle, Calendar as CalendarIcon, Download, ExternalLink,
  ChevronRight, Activity, BarChart3, PieChartIcon, ArrowUpRight, ArrowDownRight, Image
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButton } from '@/components/ui/export-button';
import { exportChartAsImage } from '@/utils/exportUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const STAGE_COLORS = {
  'Prospecting': '#3b82f6',
  'Qualified': '#8b5cf6',
  'Proposal': '#f59e0b',
  'Negotiation': '#f97316',
  'Closed-Won': '#22c55e',
  'Order Booked': '#10b981',
  'Closed-Lost': '#ef4444',
  'Closed-Dropped': '#6b7280'
};

const EntityProfile = () => {
  const { entityType, entityId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Local date range state (independent of global filter)
  const getDefaultDateRange = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    // Indian FY starts April 1
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    return {
      from: `${fyStartYear}-04-01`,
      to: format(now, 'yyyy-MM-dd')
    };
  };
  
  const [localDateRange, setLocalDateRange] = useState(getDefaultDateRange());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentLeadsPage, setRecentLeadsPage] = useState(1);
  const [recentLeads, setRecentLeads] = useState({ leads: [], total: 0, pages: 1 });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Enhanced analytics state
  const [enhancedData, setEnhancedData] = useState(null);
  const [loadingEnhanced, setLoadingEnhanced] = useState(false);
  const [timeFrame, setTimeFrame] = useState('monthly');
  const [breakdownBy, setBreakdownBy] = useState('segment');
  
  // Chart refs for image export
  const pipelineChartRef = useRef(null);
  const yoyChartRef = useRef(null);

  const entityIcons = {
    state: MapPin,
    dealer: Building2,
    city: MapPin,
    employee: User
  };

  const EntityIcon = entityIcons[entityType] || MapPin;

  useEffect(() => {
    loadProfile();
    loadEnhancedAnalytics();
  }, [entityType, entityId, localDateRange]);

  useEffect(() => {
    if (profile) {
      loadRecentLeads();
    }
  }, [recentLeadsPage, profile]);
  
  useEffect(() => {
    loadEnhancedAnalytics();
  }, [timeFrame, breakdownBy]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (localDateRange?.from) params.append('start_date', localDateRange.from);
      if (localDateRange?.to) params.append('end_date', localDateRange.to);
      
      const res = await axios.get(
        `${API}/entity/profile/${entityType}/${encodeURIComponent(entityId)}?${params}`,
        { withCredentials: true }
      );
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadEnhancedAnalytics = async () => {
    setLoadingEnhanced(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('start_date', dateRange.from);
      if (dateRange?.to) params.append('end_date', dateRange.to);
      params.append('time_frame', timeFrame);
      params.append('breakdown_by', breakdownBy);
      
      const res = await axios.get(
        `${API}/entity/enhanced-analytics/${entityType}/${encodeURIComponent(entityId)}?${params}`,
        { withCredentials: true }
      );
      setEnhancedData(res.data);
    } catch (err) {
      console.error('Failed to load enhanced analytics:', err);
    } finally {
      setLoadingEnhanced(false);
    }
  };

  const loadRecentLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await axios.get(
        `${API}/entity/recent-leads/${entityType}/${encodeURIComponent(entityId)}?page=${recentLeadsPage}&limit=10`,
        { withCredentials: true }
      );
      setRecentLeads(res.data);
    } catch (err) {
      console.error('Failed to load recent leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('start_date', dateRange.from);
      if (dateRange?.to) params.append('end_date', dateRange.to);
      
      const res = await axios.get(
        `${API}/entity/export/${entityType}/${encodeURIComponent(entityId)}?${params}`,
        { withCredentials: true, responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entityType}_${entityId}_leads.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded successfully');
    } catch (err) {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const navigateToEntity = (type, id) => {
    navigate(`/profile/${type}/${encodeURIComponent(id)}`);
  };

  const getStageColor = (stage) => STAGE_COLORS[stage] || '#6b7280';

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Profile not found</h2>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const { kpis, source_breakdown, segment_performance, trend, 
          mom_comparison, sub_entities, top_performers, followup_status, activity_timeline,
          duplicate_leads_count, order_time_punch_count } = profile;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {profile.state && entityType !== 'state' && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigateToEntity('state', profile.state); }}
                >
                  {profile.state}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {profile.dealer && entityType === 'employee' && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  href="#"
                  onClick={(e) => { e.preventDefault(); navigateToEntity('dealer', profile.dealer); }}
                >
                  {profile.dealer}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{profile.entity_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <EntityIcon className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{profile.entity_name}</h1>
              <Badge variant="outline" className="capitalize">{entityType}</Badge>
            </div>
            <p className="text-muted-foreground">
              {profile.state && entityType !== 'state' && `${profile.state}`}
              {profile.dealer && entityType === 'employee' && ` • ${profile.dealer}`}
            </p>
            {profile.date_range && (
              <p className="text-xs text-muted-foreground mt-1">
                <Calendar className="inline h-3 w-3 mr-1" />
                {profile.date_range.start_date} to {profile.date_range.end_date}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={recentLeads.leads}
            filename={`${entityType}_${entityId}_analytics`}
            sheetName="Entity Data"
            columns={[
              { key: 'enquiry_no', header: 'Enquiry No', width: 15 },
              { key: 'name', header: 'Customer Name', width: 20 },
              { key: 'phone_number', header: 'Phone', width: 15 },
              { key: 'kva', header: 'KVA', width: 10 },
              { key: 'enquiry_status', header: 'Status', width: 15 },
              { key: 'enquiry_stage', header: 'Stage', width: 15 },
              { key: 'enquiry_date', header: 'Enquiry Date', width: 15 },
              { key: 'segment', header: 'Segment', width: 15 }
            ]}
            chartRef={pipelineChartRef.current}
            size="sm"
          >
            Export
          </ExportButton>
          <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export All'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Total Leads
            </div>
            <p className="text-2xl font-bold mt-1">{(kpis?.total_leads ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4 text-blue-500" />
              Open
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{(kpis?.open_leads ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Won
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{(kpis?.won_leads ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <XCircle className="h-4 w-4 text-red-500" />
              Lost
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{(kpis?.lost_leads ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Conversion
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{kpis?.conversion_rate ?? 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              Avg Age
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{kpis?.avg_lead_age ?? 0}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4 text-violet-500" />
              Avg Close
            </div>
            <p className="text-2xl font-bold mt-1 text-violet-600">{kpis?.avg_closure_time ?? 0}d</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Analytics Section */}
      {enhancedData && (
        <>
          {/* Market Share + YoY + Rank */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Market Share Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" />
                  Market Share
                </CardTitle>
                <CardDescription className="text-xs">Based on market potential</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Overall Share</span>
                    <span className="text-lg font-bold text-primary">{enhancedData.market_share?.share_of_company || 0}%</span>
                  </div>
                  {enhancedData.market_share?.share_of_state !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">State: {enhancedData.market_share?.state}</span>
                      <span className="text-lg font-bold text-blue-600">{enhancedData.market_share?.share_of_state || 0}%</span>
                    </div>
                  )}
                  {enhancedData.market_share?.share_of_dealer !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Dealer Share</span>
                      <span className="text-lg font-bold text-emerald-600">{enhancedData.market_share?.share_of_dealer || 0}%</span>
                    </div>
                  )}
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    {enhancedData.market_share?.entity_wins || 0} wins / {enhancedData.market_share?.total_market_potential || 0} market potential
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* YoY Comparison Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Year-over-Year
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Leads</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{enhancedData.yoy_comparison?.current_year?.total_leads || 0}</span>
                      <Badge variant={enhancedData.yoy_comparison?.yoy_change?.total_leads >= 0 ? "default" : "destructive"} className="text-xs">
                        {enhancedData.yoy_comparison?.yoy_change?.total_leads >= 0 ? '+' : ''}{enhancedData.yoy_comparison?.yoy_change?.total_leads || 0}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Won Leads</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-green-600">{enhancedData.yoy_comparison?.current_year?.won_leads || 0}</span>
                      <Badge variant={enhancedData.yoy_comparison?.yoy_change?.won_leads >= 0 ? "default" : "destructive"} className="text-xs">
                        {enhancedData.yoy_comparison?.yoy_change?.won_leads >= 0 ? '+' : ''}{enhancedData.yoy_comparison?.yoy_change?.won_leads || 0}%
                      </Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    vs Last Year: {enhancedData.yoy_comparison?.last_year?.won_leads || 0} wins
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rank Card */}
            {enhancedData.rank && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Rank & Position
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">#{enhancedData.rank.position}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      out of {enhancedData.rank.total} {entityType === 'dealer' ? 'dealers' : 'employees'}
                    </p>
                    {enhancedData.rank.within && (
                      <p className="text-xs text-muted-foreground">within {enhancedData.rank.within}</p>
                    )}
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Top {100 - enhancedData.rank.percentile}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pipeline Health + Lead Age Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pipeline Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pipeline Health (Open Leads)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">Hot</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{enhancedData.pipeline_health?.hot?.count || 0}</span>
                      <span className="text-xs text-muted-foreground">({enhancedData.pipeline_health?.distribution?.hot_pct || 0}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm">Warm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{enhancedData.pipeline_health?.warm?.count || 0}</span>
                      <span className="text-xs text-muted-foreground">({enhancedData.pipeline_health?.distribution?.warm_pct || 0}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm">Cold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{enhancedData.pipeline_health?.cold?.count || 0}</span>
                      <span className="text-xs text-muted-foreground">({enhancedData.pipeline_health?.distribution?.cold_pct || 0}%)</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Open</span>
                    <span className="font-bold">{enhancedData.pipeline_health?.total_open || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lead Age Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lead Age Distribution (Open)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(enhancedData.lead_age_distribution || {}).map(([bucket, data]) => (
                    <div key={bucket} className="flex items-center justify-between">
                      <span className="text-sm">{bucket} days</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{data.count}</span>
                        <span className="text-xs text-muted-foreground">({data.kva} KVA)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mini Summary Builder */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Summary Builder
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={timeFrame} onValueChange={setTimeFrame}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue placeholder="Time Frame" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Period</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Won</TableHead>
                      <TableHead className="text-xs text-right">Lost</TableHead>
                      <TableHead className="text-xs text-right">Open</TableHead>
                      <TableHead className="text-xs text-right">Conv %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enhancedData.summary_builder || []).map((row) => (
                      <TableRow key={row.period}>
                        <TableCell className="text-xs font-medium">{row.period}</TableCell>
                        <TableCell className="text-xs text-right">{row.total_leads}</TableCell>
                        <TableCell className="text-xs text-right text-green-600">{row.won_leads}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{row.lost_leads}</TableCell>
                        <TableCell className="text-xs text-right text-blue-600">{row.open_leads}</TableCell>
                        <TableCell className="text-xs text-right">{row.conversion_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {(!enhancedData.summary_builder || enhancedData.summary_builder.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground text-xs">
                          No data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* District Market Share Breakdown (for dealers) */}
          {enhancedData.market_share?.district_breakdown && enhancedData.market_share.district_breakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  District-wise Market Share ({enhancedData.market_share.district_breakdown.length} Districts)
                </CardTitle>
                <CardDescription className="text-xs">Won leads vs market potential per district</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">District</TableHead>
                        <TableHead className="text-xs text-right">Won</TableHead>
                        <TableHead className="text-xs text-right">Potential</TableHead>
                        <TableHead className="text-xs text-right">Market Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enhancedData.market_share.district_breakdown.map((dist) => (
                        <TableRow key={dist.district}>
                          <TableCell className="text-xs font-medium">{dist.district}</TableCell>
                          <TableCell className="text-xs text-right text-green-600">{dist.won}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">{dist.potential}</TableCell>
                          <TableCell className="text-xs text-right">
                            <Badge variant={dist.share >= 20 ? "default" : dist.share >= 10 ? "secondary" : "outline"}>
                              {dist.share}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* KVA Breakdown + Top Segments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KVA Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">KVA Breakdown (Individual Values)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">KVA</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-right">Won</TableHead>
                        <TableHead className="text-xs text-right">Conv %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(enhancedData.kva_breakdown || []).map((row) => (
                        <TableRow key={row.kva}>
                          <TableCell className="text-xs font-medium">{row.kva}</TableCell>
                          <TableCell className="text-xs text-right">{row.total_leads}</TableCell>
                          <TableCell className="text-xs text-right text-green-600">{row.won_leads}</TableCell>
                          <TableCell className="text-xs text-right">{row.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                      {(!enhancedData.kva_breakdown || enhancedData.kva_breakdown.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">
                            No KVA data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Top Segments */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Segments</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Segment</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-right">Won</TableHead>
                        <TableHead className="text-xs text-right">Conv %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(enhancedData.top_segments || []).map((row) => (
                        <TableRow key={row.segment}>
                          <TableCell className="text-xs font-medium">{row.segment}</TableCell>
                          <TableCell className="text-xs text-right">{row.total_leads}</TableCell>
                          <TableCell className="text-xs text-right text-green-600">{row.won_leads}</TableCell>
                          <TableCell className="text-xs text-right">{row.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                      {(!enhancedData.top_segments || enhancedData.top_segments.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-xs">
                            No segment data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Dimension Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Breakdown By</CardTitle>
                <Select value={breakdownBy} onValueChange={setBreakdownBy}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Dimension" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segment">Segment</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="dealer">Dealer</SelectItem>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="kva">KVA</SelectItem>
                    <SelectItem value="district">District</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{breakdownBy.charAt(0).toUpperCase() + breakdownBy.slice(1)}</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Won</TableHead>
                      <TableHead className="text-xs text-right">Lost</TableHead>
                      <TableHead className="text-xs text-right">Open</TableHead>
                      <TableHead className="text-xs text-right">Conv %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enhancedData.breakdown?.data || []).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-medium">{row.name}</TableCell>
                        <TableCell className="text-xs text-right">{row.total_leads}</TableCell>
                        <TableCell className="text-xs text-right text-green-600">{row.won_leads}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{row.lost_leads}</TableCell>
                        <TableCell className="text-xs text-right text-blue-600">{row.open_leads}</TableCell>
                        <TableCell className="text-xs text-right">{row.conversion_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {(!enhancedData.breakdown?.data || enhancedData.breakdown.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground text-xs">
                          No breakdown data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Month-over-Month + Follow-up Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Month-over-Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{mom_comparison.current_count}</p>
                <p className="text-xs text-muted-foreground">{mom_comparison.current_month}</p>
              </div>
              <div className={`flex items-center gap-1 ${mom_comparison.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {mom_comparison.change_percent >= 0 ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
                <span className="text-lg font-semibold">{Math.abs(mom_comparison.change_percent)}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              vs {mom_comparison.prev_count} in {mom_comparison.prev_month}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Follow-up Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xl font-bold text-red-600">{followup_status.overdue}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xl font-bold text-green-600">{followup_status.on_track}</p>
                  <p className="text-xs text-muted-foreground">On Track</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {top_performers && top_performers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Top {entityType === 'state' ? 'Dealers' : 'Employees'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top_performers.slice(0, 3).map((performer, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <button 
                      onClick={() => navigateToEntity(entityType === 'state' ? 'dealer' : 'employee', performer.name)}
                      className="text-sm hover:text-primary hover:underline truncate max-w-[150px]"
                    >
                      {idx + 1}. {performer.name}
                    </button>
                    <Badge variant="outline" className="text-green-600">
                      {performer.conversion_rate}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Quality Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Data Quality Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <p className="text-sm font-medium text-orange-800">Duplicate Leads Uploaded</p>
                  <p className="text-xs text-orange-600">Leads flagged as duplicates</p>
                </div>
                <div className="text-3xl font-bold text-orange-600">{duplicate_leads_count || 0}</div>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="text-sm font-medium text-blue-800">Order Time Punch</p>
                  <p className="text-xs text-blue-600">Leads with sales order data</p>
                </div>
                <div className="text-3xl font-bold text-blue-600">{order_time_punch_count || 0}</div>
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {kpis?.total_leads ? (
                  <>
                    Duplicate rate: {((duplicate_leads_count || 0) / kpis.total_leads * 100).toFixed(1)}% • 
                    Order capture rate: {((order_time_punch_count || 0) / kpis.total_leads * 100).toFixed(1)}%
                  </>
                ) : 'No lead data available'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trend Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
                <Line type="monotone" dataKey="won" stroke="#22c55e" name="Won" strokeWidth={2} />
                <Line type="monotone" dataKey="lost" stroke="#ef4444" name="Lost" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Source & Segment Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Source */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Source Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={source_breakdown.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="source" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Segment Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Segment Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segment_performance.map((seg, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{seg.segment}</TableCell>
                      <TableCell className="text-right">{seg.total}</TableCell>
                      <TableCell className="text-right text-green-600">{seg.won}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={seg.conversion_rate > 20 ? 'default' : 'secondary'}>
                          {seg.conversion_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Sub-entities Tables */}
      {sub_entities && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sub_entities.dealers && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Dealers ({sub_entities.dealers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dealer</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Conv %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub_entities.dealers.map((dealer, idx) => (
                        <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => navigateToEntity('dealer', dealer.name)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {dealer.name}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{dealer.total}</TableCell>
                          <TableCell className="text-right text-green-600">{dealer.won}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={dealer.conversion_rate > 20 ? 'default' : 'outline'}>
                              {dealer.conversion_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {sub_entities.employees && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Employees ({sub_entities.employees.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Conv %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub_entities.employees.map((emp, idx) => (
                        <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => navigateToEntity('employee', emp.name)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {emp.name}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{emp.total}</TableCell>
                          <TableCell className="text-right text-green-600">{emp.won}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={emp.conversion_rate > 20 ? 'default' : 'outline'}>
                              {emp.conversion_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {sub_entities.districts && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Districts ({sub_entities.districts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>District</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Conv %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub_entities.districts.map((district, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{district.name}</TableCell>
                          <TableCell className="text-right">{district.total}</TableCell>
                          <TableCell className="text-right text-green-600">{district.won}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={district.conversion_rate > 20 ? 'default' : 'outline'}>
                              {district.conversion_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Leads (Last 7 Days)
              </CardTitle>
              <CardDescription>
                Showing {recentLeads.leads.length} of {recentLeads.total} leads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enquiry No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Source</TableHead>
                {entityType !== 'dealer' && <TableHead>Dealer</TableHead>}
                {entityType !== 'employee' && <TableHead>Employee</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLeads ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : recentLeads.leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No leads added in the last 7 days
                  </TableCell>
                </TableRow>
              ) : (
                recentLeads.leads.map((lead, idx) => (
                  <TableRow key={lead.lead_id || idx}>
                    <TableCell className="font-mono text-xs">{lead.enquiry_no}</TableCell>
                    <TableCell className="font-medium">{lead.name || '-'}</TableCell>
                    <TableCell>{lead.enquiry_date}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        style={{ borderColor: getStageColor(lead.enquiry_stage), color: getStageColor(lead.enquiry_stage) }}
                      >
                        {lead.enquiry_stage}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.segment || '-'}</TableCell>
                    <TableCell>{lead.source || '-'}</TableCell>
                    {entityType !== 'dealer' && (
                      <TableCell>
                        <button 
                          onClick={() => navigateToEntity('dealer', lead.dealer)}
                          className="text-sm hover:text-primary hover:underline"
                        >
                          {lead.dealer || '-'}
                        </button>
                      </TableCell>
                    )}
                    {entityType !== 'employee' && (
                      <TableCell>
                        <button 
                          onClick={() => navigateToEntity('employee', lead.employee_name)}
                          className="text-sm hover:text-primary hover:underline"
                        >
                          {lead.employee_name || '-'}
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {recentLeads.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecentLeadsPage(p => Math.max(1, p - 1))}
                disabled={recentLeadsPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {recentLeadsPage} of {recentLeads.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecentLeadsPage(p => Math.min(recentLeads.pages, p + 1))}
                disabled={recentLeadsPage === recentLeads.pages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      {activity_timeline && activity_timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity_timeline.slice(0, 10).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="p-2 rounded-full bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.user_name} • {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EntityProfile;
