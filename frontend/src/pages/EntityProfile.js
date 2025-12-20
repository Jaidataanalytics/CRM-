import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { 
  MapPin, Building2, User, Users, Target, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, AlertTriangle, Calendar, Download, ExternalLink,
  ChevronRight, Activity, BarChart3, PieChartIcon, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';

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
  const { dateRange } = useFilters();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentLeadsPage, setRecentLeadsPage] = useState(1);
  const [recentLeads, setRecentLeads] = useState({ leads: [], total: 0, pages: 1 });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [exporting, setExporting] = useState(false);

  const entityIcons = {
    state: MapPin,
    dealer: Building2,
    city: MapPin,
    employee: User
  };

  const EntityIcon = entityIcons[entityType] || MapPin;

  useEffect(() => {
    loadProfile();
  }, [entityType, entityId, dateRange]);

  useEffect(() => {
    if (profile) {
      loadRecentLeads();
    }
  }, [recentLeadsPage, profile]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('start_date', dateRange.from);
      if (dateRange?.to) params.append('end_date', dateRange.to);
      
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

  const { kpis, stage_breakdown, source_breakdown, segment_performance, trend, 
          mom_comparison, sub_entities, top_performers, followup_status, activity_timeline } = profile;

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
          </div>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export Data'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Total Leads
            </div>
            <p className="text-2xl font-bold mt-1">{kpis.total_leads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4 text-blue-500" />
              Open
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{kpis.open_leads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Won
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{kpis.won_leads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <XCircle className="h-4 w-4 text-red-500" />
              Lost
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{kpis.lost_leads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Conversion
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{kpis.conversion_rate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              Avg Age
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{kpis.avg_lead_age}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4 text-violet-500" />
              Avg Close
            </div>
            <p className="text-2xl font-bold mt-1 text-violet-600">{kpis.avg_closure_time}d</p>
          </CardContent>
        </Card>
      </div>

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
        {/* Stage Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Lead Stage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stage_breakdown}
                  dataKey="count"
                  nameKey="stage"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ stage, percent }) => `${stage}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {stage_breakdown.map((entry, idx) => (
                    <Cell key={idx} fill={getStageColor(entry.stage)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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

          {sub_entities.cities && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Cities ({sub_entities.cities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Conv %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub_entities.cities.map((city, idx) => (
                        <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => navigateToEntity('city', city.name)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {city.name}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{city.total}</TableCell>
                          <TableCell className="text-right text-green-600">{city.won}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={city.conversion_rate > 20 ? 'default' : 'outline'}>
                              {city.conversion_rate}%
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
