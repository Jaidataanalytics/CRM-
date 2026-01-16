import { useState, useEffect } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Flame,
  CheckCircle,
  XCircle,
  ThermometerSun,
  Snowflake,
  ShieldCheck,
  ShieldX,
  Edit,
  Clock,
  User,
  BarChart3,
  Timer,
  CheckCircle2,
  Percent,
  Phone,
  FileText,
  PhoneCall,
  ArrowLeftRight,
  Truck,
  Package,
  History,
  Settings
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const KPICard = ({ title, value, qty, icon: Icon, color, onClick, onDoubleClick, active, trend, unit }) => {
  const formatValue = (val) => {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
    return val;
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${active ? 'ring-2 ring-primary shadow-lg' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s/g, '-')}`}
      title="Click to filter • Double-click to view all"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-muted/50`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          {qty !== undefined && qty > 0 ? (
            <>
              <span className="text-2xl font-bold font-heading">{formatValue(qty)}</span>
              <span className="text-sm text-muted-foreground">Qty</span>
              <span className="text-sm text-muted-foreground ml-1">({formatValue(value)} Leads)</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold font-heading">{formatValue(value)}</span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </>
          )}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(trend)}% vs last period</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Double-click to view leads →</p>
      </CardContent>
    </Card>
  );
};

const LeadDetailPopup = ({ lead, isOpen, onClose, onEdit }) => {
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [qualification, setQualification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && lead) {
      loadDetails();
    }
  }, [isOpen, lead]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [activitiesRes, followupsRes, qualRes] = await Promise.all([
        axios.get(`${API}/lead-activities/${lead.lead_id}`, { withCredentials: true }),
        axios.get(`${API}/lead-activities/${lead.lead_id}/followups`, { withCredentials: true }),
        axios.get(`${API}/qualification/leads/${lead.lead_id}/qualification`, { withCredentials: true })
      ]);
      setActivities(activitiesRes.data.activities || []);
      setFollowups(followupsRes.data.followups || []);
      setQualification(qualRes.data);
    } catch (error) {
      console.error('Error loading lead details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (stage) => {
    const variants = {
      'Closed-Won': 'bg-green-100 text-green-800',
      'Closed-Lost': 'bg-red-100 text-red-800',
      'Prospecting': 'bg-blue-100 text-blue-800',
    };
    return <Badge className={variants[stage] || 'bg-gray-100 text-gray-800'}>{stage || 'N/A'}</Badge>;
  };

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="font-heading text-xl">Lead Details</DialogTitle>
          <Button variant="outline" size="sm" onClick={() => onEdit(lead)} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Lead
          </Button>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="qualification">Qualification</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Basic Information</h3>
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">Enquiry No:</span> <span className="font-mono">{lead.enquiry_no || '-'}</span></div>
                    <div><span className="text-muted-foreground">Name:</span> {lead.name || lead.corporate_name || '-'}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {lead.phone_number || '-'}</div>
                    <div><span className="text-muted-foreground">Email:</span> {lead.email_address || '-'}</div>
                    <div><span className="text-muted-foreground">Customer Type:</span> {lead.customer_type || '-'}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Location</h3>
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">State:</span> {lead.state || '-'}</div>
                    <div><span className="text-muted-foreground">District:</span> {lead.district || '-'}</div>
                    <div><span className="text-muted-foreground">Area:</span> {lead.area || '-'}</div>
                    <div><span className="text-muted-foreground">Pincode:</span> {lead.pincode || '-'}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Assignment</h3>
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">Dealer:</span> {lead.dealer || '-'}</div>
                    <div><span className="text-muted-foreground">Employee:</span> {lead.employee_name || '-'}</div>
                    <div><span className="text-muted-foreground">Zone:</span> {lead.zone || '-'}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Status</h3>
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">Stage:</span> {getStatusBadge(lead.enquiry_stage)}</div>
                    <div><span className="text-muted-foreground">Status:</span> {lead.enquiry_status || '-'}</div>
                    <div><span className="text-muted-foreground">Type:</span> 
                      <Badge variant="outline" className="ml-2">{lead.enquiry_type || '-'}</Badge>
                    </div>
                    <div><span className="text-muted-foreground">Qualified:</span> 
                      {lead.is_qualified === true && <Badge className="ml-2 bg-green-100 text-green-800">Qualified</Badge>}
                      {lead.is_qualified === false && <Badge className="ml-2 bg-red-100 text-red-800">Faulty</Badge>}
                      {lead.is_qualified === undefined && <Badge variant="outline" className="ml-2">Not Evaluated</Badge>}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Product</h3>
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">Segment:</span> {lead.segment || '-'}</div>
                    <div><span className="text-muted-foreground">Sub-Segment:</span> {lead.sub_segment || '-'}</div>
                    <div><span className="text-muted-foreground">KVA:</span> {lead.kva || '-'}</div>
                    <div><span className="text-muted-foreground">Phase:</span> {lead.phase || '-'}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Dates</h3>
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">Enquiry Date:</span> {lead.enquiry_date || '-'}</div>
                    <div><span className="text-muted-foreground">Last Follow-up:</span> {lead.last_followup_date || '-'}</div>
                    <div><span className="text-muted-foreground">Follow-ups:</span> {lead.no_of_followups || 0}</div>
                  </div>
                </div>
              </div>
              {lead.remarks && (
                <div className="space-y-2 pt-4 border-t">
                  <h3 className="font-semibold text-sm text-muted-foreground">Remarks</h3>
                  <p className="text-sm">{lead.remarks}</p>
                </div>
              )}
            </TabsContent>

            {/* Qualification Tab */}
            <TabsContent value="qualification" className="space-y-4">
              {loading ? (
                <Skeleton className="h-32" />
              ) : qualification ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Qualification Score</p>
                      <p className="text-2xl font-bold">{qualification.qualification_score || 0} / {qualification.threshold}</p>
                    </div>
                    <div>
                      {lead.is_qualified === true && (
                        <Badge className="bg-green-100 text-green-800 text-lg px-4 py-2">
                          <ShieldCheck className="h-5 w-5 mr-2" />
                          Qualified
                        </Badge>
                      )}
                      {lead.is_qualified === false && (
                        <Badge className="bg-red-100 text-red-800 text-lg px-4 py-2">
                          <ShieldX className="h-5 w-5 mr-2" />
                          Faulty
                        </Badge>
                      )}
                      {lead.is_qualified === undefined && (
                        <Badge variant="outline" className="text-lg px-4 py-2">Not Evaluated</Badge>
                      )}
                    </div>
                  </div>
                  
                  {qualification.qualification_answers?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Answers</h3>
                      {qualification.questions?.map(q => {
                        const answer = qualification.qualification_answers?.find(a => a.question_id === q.question_id);
                        const selectedOption = q.options?.find(o => o.option_id === answer?.option_id);
                        
                        return (
                          <div key={q.question_id} className="p-3 border rounded-lg">
                            <p className="font-medium">{q.question}</p>
                            {answer ? (
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-sm">{selectedOption?.text || 'Unknown'}</span>
                                <Badge variant="outline">+{answer.score} points</Badge>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground mt-2">Not answered</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No qualification data available</p>
              )}
            </TabsContent>

            {/* Follow-ups Tab */}
            <TabsContent value="followups" className="space-y-4">
              {loading ? (
                <Skeleton className="h-32" />
              ) : followups.length > 0 ? (
                <div className="space-y-3">
                  {followups.map((fu, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{fu.followup_date}</span>
                        </div>
                        {fu.outcome && <Badge variant="outline">{fu.outcome}</Badge>}
                      </div>
                      {fu.notes && <p className="text-sm mt-2">{fu.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-2">By {fu.user_name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No follow-ups recorded</p>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              {loading ? (
                <Skeleton className="h-32" />
              ) : activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((act, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{act.user_name || 'System'}</span>
                        </div>
                        <Badge variant="outline">{act.action}</Badge>
                      </div>
                      {act.notes && <p className="text-sm mt-2">{act.notes}</p>}
                      {act.field_changes && (
                        <div className="text-xs mt-2 space-y-1">
                          {Object.entries(act.field_changes).map(([field, change]) => (
                            <div key={field} className="text-muted-foreground">
                              {field}: {JSON.stringify(change.old)} → {JSON.stringify(change.new)}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">{formatDate(act.created_at)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No activity history</p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const Dashboard = () => {
  const { buildQueryParams } = useFilters();
  const [kpis, setKpis] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showKpiSettings, setShowKpiSettings] = useState(false);
  
  // KPI visibility settings - stored in localStorage
  const defaultKpiVisibility = {
    total_leads: true,
    won_leads: true,
    lost_leads: true,
    open_leads: true,
    hot_leads: true,
    warm_leads: true,
    cold_leads: true,
    conversion_rate: true,
    calls_placed: true,
    quotations_sent: true,
    call_to_quotation_rate: true,
    not_called: true,
    qualified_leads: true,
    faulty_leads: true,
    transferred_leads: true,
    old_enquiries_closed: true,
    pending_dispatch: true,
    dispatched: true
  };
  
  const [kpiVisibility, setKpiVisibility] = useState(() => {
    const saved = localStorage.getItem('kpiVisibility');
    return saved ? JSON.parse(saved) : defaultKpiVisibility;
  });
  
  const toggleKpiVisibility = (kpiKey) => {
    const newVisibility = { ...kpiVisibility, [kpiKey]: !kpiVisibility[kpiKey] };
    setKpiVisibility(newVisibility);
    localStorage.setItem('kpiVisibility', JSON.stringify(newVisibility));
  };
  
  const resetKpiVisibility = () => {
    setKpiVisibility(defaultKpiVisibility);
    localStorage.setItem('kpiVisibility', JSON.stringify(defaultKpiVisibility));
  };

  useEffect(() => {
    loadData();
  }, [buildQueryParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      const [kpisRes, leadsRes] = await Promise.all([
        axios.get(`${API}/kpis?${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/leads?${queryParams}&limit=10`, { withCredentials: true })
      ]);
      setKpis(kpisRes.data);
      setLeads(leadsRes.data.leads || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKPIClick = async (filter) => {
    setSelectedKPI(filter);
    try {
      let endpoint = `${API}/leads?${buildQueryParams()}&limit=50`;
      if (filter === 'won') endpoint += '&enquiry_stage=Closed-Won';
      else if (filter === 'lost') endpoint += '&enquiry_stage=Closed-Lost';
      else if (filter === 'open') endpoint += '&enquiry_status=Open';
      else if (filter === 'hot') endpoint += '&enquiry_type=Hot&enquiry_status=Open';
      else if (filter === 'warm') endpoint += '&enquiry_type=Warm&enquiry_status=Open';
      else if (filter === 'cold') endpoint += '&enquiry_type=Cold&enquiry_status=Open';
      
      const res = await axios.get(endpoint, { withCredentials: true });
      setLeads(res.data.leads || []);
    } catch (error) {
      console.error('Error filtering leads:', error);
    }
  };

  const handleKPINavigate = (filter) => {
    // Build the URL with filter parameters
    let url = '/leads?';
    const params = new URLSearchParams();
    
    // Add existing date filters
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    if (filters.state) params.append('state', filters.state);
    if (filters.dealer) params.append('dealer', filters.dealer);
    if (filters.employee) params.append('employee', filters.employee);
    if (filters.segment) params.append('segment', filters.segment);
    
    // Add KPI-specific filters
    if (filter === 'won') params.append('stage', 'Closed-Won');
    else if (filter === 'lost') params.append('stage', 'Closed-Lost');
    else if (filter === 'open') params.append('status', 'Open');
    else if (filter === 'hot') {
      params.append('lead_type', 'Hot');
      params.append('status', 'Open');
    }
    else if (filter === 'warm') {
      params.append('lead_type', 'Warm');
      params.append('status', 'Open');
    }
    else if (filter === 'cold') {
      params.append('lead_type', 'Cold');
      params.append('status', 'Open');
    }
    
    window.location.href = url + params.toString();
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleEditLead = (lead) => {
    setIsDetailOpen(false);
    window.location.href = `/leads?edit=${lead.lead_id}`;
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Closed-Won': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Closed-Lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Prospecting': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Open': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>{status || 'N/A'}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {kpis?.date_range?.start_date} to {kpis?.date_range?.end_date}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowKpiSettings(true)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          KPI Settings
        </Button>
      </div>

      {/* KPI Settings Dialog */}
      <Dialog open={showKpiSettings} onOpenChange={setShowKpiSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>KPI Card Visibility</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid gap-3">
              {[
                { key: 'total_leads', label: 'Total Leads' },
                { key: 'won_leads', label: 'Won Leads' },
                { key: 'lost_leads', label: 'Lost Leads' },
                { key: 'open_leads', label: 'Open Leads' },
                { key: 'hot_leads', label: 'Hot Leads' },
                { key: 'warm_leads', label: 'Warm Leads' },
                { key: 'cold_leads', label: 'Cold Leads' },
                { key: 'conversion_rate', label: 'Conversion Rate' },
                { key: 'calls_placed', label: 'Calls Placed' },
                { key: 'quotations_sent', label: 'Quotations Sent' },
                { key: 'call_to_quotation_rate', label: 'Call to Quotation Rate' },
                { key: 'not_called', label: 'Not Called' },
                { key: 'qualified_leads', label: 'Qualified Leads' },
                { key: 'faulty_leads', label: 'Faulty Leads' },
                { key: 'transferred_leads', label: 'Transferred Leads' },
                { key: 'old_enquiries_closed', label: 'Old Enquiries Closed' },
                { key: 'pending_dispatch', label: 'Pending Dispatch' },
                { key: 'dispatched', label: 'Dispatched' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="text-sm">{label}</Label>
                  <Switch
                    id={key}
                    checked={kpiVisibility[key]}
                    onCheckedChange={() => toggleKpiVisibility(key)}
                  />
                </div>
              ))}
            </div>
            <div className="pt-4 border-t">
              <Button variant="outline" size="sm" onClick={resetKpiVisibility}>
                Reset to Default
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiVisibility.total_leads && (
          <KPICard
            title="Total Leads"
            value={kpis?.total_leads || 0}
            icon={Users}
            color="text-primary"
            onClick={() => handleKPIClick('all')}
            onDoubleClick={() => handleKPINavigate('all')}
            active={selectedKPI === 'all'}
          />
        )}
        {kpiVisibility.won_leads && (
          <KPICard
            title="Won Leads"
            value={kpis?.won_leads || 0}
            qty={kpis?.won_qty || 0}
            icon={CheckCircle}
            color="text-green-500"
            onClick={() => handleKPIClick('won')}
            onDoubleClick={() => handleKPINavigate('won')}
            active={selectedKPI === 'won'}
          />
        )}
        {kpiVisibility.lost_leads && (
          <KPICard
            title="Lost Leads"
            value={kpis?.lost_leads || 0}
            icon={XCircle}
            color="text-red-500"
            onClick={() => handleKPIClick('lost')}
            onDoubleClick={() => handleKPINavigate('lost')}
            active={selectedKPI === 'lost'}
          />
        )}
        {kpiVisibility.open_leads && (
          <KPICard
            title="Open Leads"
            value={kpis?.open_leads || 0}
            icon={Target}
            color="text-yellow-500"
            onClick={() => handleKPIClick('open')}
            onDoubleClick={() => handleKPINavigate('open')}
            active={selectedKPI === 'open'}
          />
        )}
      </div>

      {/* KPI Cards - Row 2: Lead Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiVisibility.hot_leads && (
          <KPICard
            title="Hot Leads"
            value={kpis?.hot_leads || 0}
            icon={Flame}
            color="text-red-500"
            onClick={() => handleKPIClick('hot')}
            onDoubleClick={() => handleKPINavigate('hot')}
            active={selectedKPI === 'hot'}
          />
        )}
        {kpiVisibility.warm_leads && (
          <KPICard
            title="Warm Leads"
            value={kpis?.warm_leads || 0}
            icon={ThermometerSun}
            color="text-orange-500"
            onClick={() => handleKPIClick('warm')}
            onDoubleClick={() => handleKPINavigate('warm')}
            active={selectedKPI === 'warm'}
          />
        )}
        {kpiVisibility.cold_leads && (
          <KPICard
            title="Cold Leads"
            value={kpis?.cold_leads || 0}
            icon={Snowflake}
            color="text-blue-500"
            onClick={() => handleKPIClick('cold')}
            onDoubleClick={() => handleKPINavigate('cold')}
            active={selectedKPI === 'cold'}
          />
        )}
        {kpiVisibility.conversion_rate && (
          <KPICard
            title="Conversion Rate"
            value={`${kpis?.conversion_rate || 0}%`}
            icon={TrendingUp}
            color="text-primary"
          />
        )}
      </div>

      {/* KPI Cards - Row 3: Call & Quotation Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiVisibility.calls_placed && (
          <KPICard
            title="Calls Placed"
            value={kpis?.calls_placed || 0}
            icon={PhoneCall}
            color="text-cyan-500"
          />
        )}
        {kpiVisibility.quotations_sent && (
          <KPICard
            title="Quotations Sent"
            value={kpis?.quotations_sent || 0}
            icon={FileText}
            color="text-emerald-500"
          />
        )}
        {kpiVisibility.call_to_quotation_rate && (
          <KPICard
            title="Call to Quotation Rate"
            value={`${kpis?.call_to_quotation_rate || 0}%`}
            icon={Percent}
            color="text-indigo-500"
          />
        )}
        {kpiVisibility.not_called && (
          <KPICard
            title="Not Called"
            value={kpis?.not_called || 0}
            icon={Phone}
            color="text-gray-500"
          />
        )}
        {kpiVisibility.transferred_leads && (
          <KPICard
            title="Transferred to Dealer"
            value={kpis?.transferred_leads || 0}
            icon={ArrowLeftRight}
            color="text-indigo-500"
          />
        )}
      </div>

      {/* KPI Cards - Row 4: Time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Closed Leads"
          value={kpis?.closed_leads || 0}
          icon={CheckCircle2}
          color="text-purple-500"
        />
        <KPICard
          title="Avg Lead Age"
          value={`${kpis?.avg_lead_age || 0} days`}
          icon={Clock}
          color="text-amber-500"
        />
        <KPICard
          title="Avg Closure Time"
          value={`${kpis?.avg_closure_time || 0} days`}
          icon={Timer}
          color="text-violet-500"
        />
        
        {/* Dispatch KPI Cards */}
        {kpiVisibility.pending_dispatch && (
          <KPICard
            title="Pending Dispatch"
            value={kpis?.pending_dispatch || 0}
            qty={kpis?.pending_dispatch_qty || 0}
            icon={Clock}
            color="text-amber-600"
          />
        )}
        {kpiVisibility.dispatched && (
          <KPICard
            title="Dispatched"
            value={kpis?.dispatched || 0}
            qty={kpis?.dispatched_qty || 0}
            icon={Truck}
            color="text-blue-600"
          />
        )}
        {kpiVisibility.old_enquiries_closed && (
          <KPICard
            title="Old Enquiries Closed"
            value={kpis?.old_enquiries_closed || 0}
            qty={kpis?.old_enquiries_closed_qty || 0}
            icon={History}
            color="text-purple-600"
          />
        )}
        
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Metric Settings</CardTitle>
            <BarChart3 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Configure KPI logic in Admin → Metric Settings</p>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Recent Leads</CardTitle>
          <p className="text-sm text-muted-foreground">Click on a lead to view details</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enquiry No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Dealer</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow 
                    key={lead.lead_id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleLeadClick(lead)}
                  >
                    <TableCell className="font-mono text-sm">{lead.enquiry_no || '-'}</TableCell>
                    <TableCell>{lead.name || lead.corporate_name || '-'}</TableCell>
                    <TableCell>{lead.state || '-'}</TableCell>
                    <TableCell>{lead.dealer || '-'}</TableCell>
                    <TableCell>{lead.segment || '-'}</TableCell>
                    <TableCell>
                      {lead.is_qualified === true && <Badge className="bg-green-100 text-green-800">Yes</Badge>}
                      {lead.is_qualified === false && <Badge className="bg-red-100 text-red-800">No</Badge>}
                      {lead.is_qualified === undefined && <Badge variant="outline">-</Badge>}
                    </TableCell>
                    <TableCell>{getStatusBadge(lead.enquiry_stage)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lead Detail Popup */}
      <LeadDetailPopup
        lead={selectedLead}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={handleEditLead}
      />
    </div>
  );
};

export default Dashboard;
