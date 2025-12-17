import { useState, useEffect } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Flame,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const KPICard = ({ title, value, icon: Icon, trend, color, onClick, active }) => (
  <Card 
    className={`cursor-pointer transition-all hover:shadow-md ${active ? 'ring-2 ring-primary' : ''}`}
    onClick={onClick}
    data-testid={`kpi-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold font-heading">{value}</div>
      {trend && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          {trend > 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
          {Math.abs(trend)}% from last period
        </p>
      )}
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { buildQueryParams } = useFilters();
  const [kpis, setKpis] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKPI, setSelectedKPI] = useState(null);

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
      else if (filter === 'hot') endpoint += '&enquiry_type=Hot';
      
      const res = await axios.get(endpoint, { withCredentials: true });
      setLeads(res.data.leads || []);
    } catch (error) {
      console.error('Error filtering leads:', error);
    }
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
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {kpis?.date_range?.start_date} to {kpis?.date_range?.end_date}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Leads"
          value={kpis?.total_leads || 0}
          icon={Users}
          color="text-primary"
          onClick={() => handleKPIClick('all')}
          active={selectedKPI === 'all'}
        />
        <KPICard
          title="Won Leads"
          value={kpis?.won_leads || 0}
          icon={CheckCircle}
          color="text-green-500"
          onClick={() => handleKPIClick('won')}
          active={selectedKPI === 'won'}
        />
        <KPICard
          title="Lost Leads"
          value={kpis?.lost_leads || 0}
          icon={XCircle}
          color="text-red-500"
          onClick={() => handleKPIClick('lost')}
          active={selectedKPI === 'lost'}
        />
        <KPICard
          title="Open Leads"
          value={kpis?.open_leads || 0}
          icon={Target}
          color="text-yellow-500"
          onClick={() => handleKPIClick('open')}
          active={selectedKPI === 'open'}
        />
      </div>

      {/* Second row of KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Hot Leads"
          value={kpis?.hot_leads || 0}
          icon={Flame}
          color="text-orange-500"
          onClick={() => handleKPIClick('hot')}
          active={selectedKPI === 'hot'}
        />
        <KPICard
          title="Conversion Rate"
          value={`${kpis?.conversion_rate || 0}%`}
          icon={TrendingUp}
          color="text-primary"
        />
        <KPICard
          title="Average KVA"
          value={kpis?.avg_kva || 0}
          icon={Zap}
          color="text-purple-500"
        />
        <KPICard
          title="Total KVA"
          value={kpis?.total_kva?.toLocaleString() || 0}
          icon={Zap}
          color="text-purple-500"
        />
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Recent Leads</CardTitle>
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
                <TableHead>KVA</TableHead>
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
                  <TableRow key={lead.lead_id}>
                    <TableCell className="font-mono text-sm">{lead.enquiry_no || '-'}</TableCell>
                    <TableCell>{lead.name || lead.corporate_name || '-'}</TableCell>
                    <TableCell>{lead.state || '-'}</TableCell>
                    <TableCell>{lead.dealer || '-'}</TableCell>
                    <TableCell>{lead.segment || '-'}</TableCell>
                    <TableCell>{lead.kva || '-'}</TableCell>
                    <TableCell>{getStatusBadge(lead.enquiry_stage)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
