import { useState, useEffect } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Building, MapPin, XCircle, AlertTriangle, CheckCircle2, HelpCircle, RefreshCw, LayoutGrid, TrendingUp, TrendingDown, Lightbulb, Download } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Insights = () => {
  const { buildQueryParams } = useFilters();
  const [performerType, setPerformerType] = useState('employee');
  const [metric, setMetric] = useState('won');
  const [performers, setPerformers] = useState([]);
  const [conversionData, setConversionData] = useState([]);
  const [segmentData, setSegmentData] = useState([]);
  const [closureAnalysis, setClosureAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closureLoading, setClosureLoading] = useState(false);
  
  // Competitor Analysis state
  const [competitorDimension, setCompetitorDimension] = useState('competitor');
  const [competitorAnalysis, setCompetitorAnalysis] = useState(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  
  // Summary Builder state
  const [summaryMetric, setSummaryMetric] = useState('leads');
  const [summaryTimeFrame, setSummaryTimeFrame] = useState('monthly');
  const [summaryDimension, setSummaryDimension] = useState('employee');
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [compareHistorical, setCompareHistorical] = useState(false);

  useEffect(() => {
    loadData();
  }, [buildQueryParams, performerType, metric]);

  useEffect(() => {
    loadClosureAnalysis();
    loadCompetitorAnalysis();
  }, [buildQueryParams]);

  useEffect(() => {
    loadCompetitorAnalysis();
  }, [competitorDimension]);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      const [performersRes, conversionRes, segmentRes] = await Promise.all([
        axios.get(`${API}/insights/top-performers?by=${performerType}&metric=${metric}&${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/insights/conversion-vs-followups?${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/insights/segment-analysis?${queryParams}`, { withCredentials: true })
      ]);
      setPerformers(performersRes.data.performers || []);
      setConversionData(conversionRes.data.data || []);
      setSegmentData(segmentRes.data.segments || []);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClosureAnalysis = async () => {
    setClosureLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/closure-analysis?${queryParams}`, { withCredentials: true });
      setClosureAnalysis(res.data);
    } catch (error) {
      console.error('Error loading closure analysis:', error);
    } finally {
      setClosureLoading(false);
    }
  };

  const loadCompetitorAnalysis = async () => {
    setCompetitorLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/competitor-analysis?dimension=${competitorDimension}&${queryParams}`, { withCredentials: true });
      setCompetitorAnalysis(res.data);
    } catch (error) {
      console.error('Error loading competitor analysis:', error);
    } finally {
      setCompetitorLoading(false);
    }
  };

  const loadSummaryBuilder = async () => {
    setSummaryLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(
        `${API}/insights/summary-builder?metric=${summaryMetric}&time_frame=${summaryTimeFrame}&dimension=${summaryDimension}&${queryParams}`,
        { withCredentials: true }
      );
      setSummaryData(res.data);
    } catch (error) {
      console.error('Error loading summary builder:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Load summary builder when params change
  useEffect(() => {
    loadSummaryBuilder();
  }, [buildQueryParams, summaryMetric, summaryTimeFrame, summaryDimension]);

  const exportSummaryToCSV = () => {
    if (!summaryData?.pivot_table) return;
    
    const { columns, rows, column_totals, grand_total } = summaryData.pivot_table;
    const dimension = summaryData.meta.dimension;
    
    // Build CSV content
    let csv = `${dimension.charAt(0).toUpperCase() + dimension.slice(1)},${columns.join(',')},Total\n`;
    
    rows.forEach(row => {
      const values = columns.map(col => row.periods[col] || 0);
      csv += `"${row.dimension}",${values.join(',')},${row.total}\n`;
    });
    
    // Add totals row
    const totalValues = columns.map(col => column_totals[col] || 0);
    csv += `Total,${totalValues.join(',')},${grand_total}\n`;
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary_${summaryDimension}_${summaryMetric}_${summaryTimeFrame}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const conversionChartData = {
    labels: conversionData.map(d => `${d.followups} follow-ups`),
    datasets: [
      {
        label: 'Conversion Rate (%)',
        data: conversionData.map(d => d.conversion_rate),
        borderColor: 'hsl(243, 75%, 59%)',
        backgroundColor: 'hsl(243, 75%, 59%, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Total Leads',
        data: conversionData.map(d => d.total_leads),
        borderColor: 'hsl(142, 71%, 45%)',
        backgroundColor: 'transparent',
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12 }
    },
    scales: {
      y: { type: 'linear', display: true, position: 'left', grid: { display: false } },
      y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
      x: { grid: { display: false } }
    }
  };

  const getPerformerIcon = () => {
    switch (performerType) {
      case 'employee': return Users;
      case 'dealer': return Building;
      case 'state': return MapPin;
      default: return Users;
    }
  };

  const Icon = getPerformerIcon();
  const maxValue = Math.max(...performers.map(p => p[metric === 'conversion_rate' ? 'conversion_rate' : metric === 'won' ? 'won_leads' : metric === 'kva' ? 'total_kva' : 'total_leads']));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground mt-1">Performance analysis and trends</p>
      </div>

      <Tabs defaultValue="performers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="performers">Top Performers</TabsTrigger>
          <TabsTrigger value="conversion">Conversion Analysis</TabsTrigger>
          <TabsTrigger value="segments">Segment Analysis</TabsTrigger>
          <TabsTrigger value="competitors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Competitor Analysis
          </TabsTrigger>
          <TabsTrigger value="closure" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Closure Analysis
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Summary Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performers" className="space-y-4">
          <div className="flex gap-4">
            <Select value={performerType} onValueChange={setPerformerType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">By Employee</SelectItem>
                <SelectItem value="dealer">By Dealer</SelectItem>
                <SelectItem value="state">By State</SelectItem>
                <SelectItem value="source">By Source</SelectItem>
              </SelectContent>
            </Select>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="won">Won Leads</SelectItem>
                <SelectItem value="total">Total Leads</SelectItem>
                <SelectItem value="conversion_rate">Conversion Rate</SelectItem>
                <SelectItem value="kva">Total KVA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top {performerType.charAt(0).toUpperCase() + performerType.slice(1)}s
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performers.map((p, idx) => {
                  const value = metric === 'conversion_rate' ? p.conversion_rate : 
                               metric === 'won' ? p.won_leads : 
                               metric === 'kva' ? p.total_kva : p.total_leads;
                  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                        {idx < 3 ? (
                          <span className={`font-bold text-sm ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-amber-600'}`}>
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">{p.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {metric === 'conversion_rate' ? `${value}%` : value.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    </div>
                  );
                })}
                {performers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rate vs Number of Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              {conversionData.length > 0 ? (
                <Line data={conversionChartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No follow-up data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments">
          <Card>
            <CardHeader>
              <CardTitle>Segment Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Lost</TableHead>
                    <TableHead className="text-right">Hot</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Avg KVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segmentData.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{s.segment}</TableCell>
                      <TableCell className="text-right">{s.total_leads}</TableCell>
                      <TableCell className="text-right text-green-600">{s.won_leads}</TableCell>
                      <TableCell className="text-right text-red-600">{s.lost_leads}</TableCell>
                      <TableCell className="text-right text-orange-600">{s.hot_leads}</TableCell>
                      <TableCell className="text-right">{s.conversion_rate}%</TableCell>
                      <TableCell className="text-right">{s.avg_kva}</TableCell>
                    </TableRow>
                  ))}
                  {segmentData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No segment data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitor Analysis Tab */}
        <TabsContent value="competitors" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={competitorDimension} onValueChange={setCompetitorDimension}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select dimension" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competitor">Competitor</SelectItem>
                  <SelectItem value="lost_reason">Lost Reason</SelectItem>
                  <SelectItem value="lost_remarks">Lost Remarks</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadCompetitorAnalysis}
                disabled={competitorLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${competitorLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {competitorLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="h-96" />
            </div>
          ) : competitorAnalysis ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Lost Leads</p>
                        <p className="text-2xl font-bold text-red-600">
                          {competitorAnalysis.summary?.total_lost_leads?.toLocaleString() || 0}
                        </p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">With {competitorDimension === 'competitor' ? 'Competitor' : competitorDimension === 'lost_reason' ? 'Reason' : 'Remarks'} Data</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {competitorAnalysis.summary?.with_data?.toLocaleString() || 0}
                        </p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Without Data</p>
                        <p className="text-2xl font-bold text-gray-600">
                          {competitorAnalysis.summary?.without_data?.toLocaleString() || 0}
                        </p>
                      </div>
                      <HelpCircle className="h-8 w-8 text-gray-400 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Unique Values</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {competitorAnalysis.summary?.unique_values || 0}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {competitorDimension === 'competitor' ? 'Top Competitors' : 
                       competitorDimension === 'lost_reason' ? 'Top Lost Reasons' : 'Top Lost Remarks'}
                    </CardTitle>
                    <CardDescription>By number of lost leads</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <Bar
                        data={{
                          labels: competitorAnalysis.analysis?.slice(0, 10).map(a => 
                            a.value?.length > 20 ? a.value.substring(0, 20) + '...' : a.value
                          ) || [],
                          datasets: [{
                            label: 'Lost Leads',
                            data: competitorAnalysis.analysis?.slice(0, 10).map(a => a.count) || [],
                            backgroundColor: 'rgba(239, 68, 68, 0.7)',
                            borderColor: 'rgb(239, 68, 68)',
                            borderWidth: 1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y',
                          plugins: {
                            legend: { display: false }
                          },
                          scales: {
                            x: { beginAtZero: true }
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Doughnut Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Distribution</CardTitle>
                    <CardDescription>Percentage breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <Doughnut
                        data={{
                          labels: competitorAnalysis.analysis?.slice(0, 8).map(a => 
                            a.value?.length > 15 ? a.value.substring(0, 15) + '...' : a.value
                          ) || [],
                          datasets: [{
                            data: competitorAnalysis.analysis?.slice(0, 8).map(a => a.count) || [],
                            backgroundColor: [
                              'rgba(239, 68, 68, 0.8)',
                              'rgba(249, 115, 22, 0.8)',
                              'rgba(234, 179, 8, 0.8)',
                              'rgba(34, 197, 94, 0.8)',
                              'rgba(59, 130, 246, 0.8)',
                              'rgba(139, 92, 246, 0.8)',
                              'rgba(236, 72, 153, 0.8)',
                              'rgba(107, 114, 128, 0.8)'
                            ]
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'right',
                              labels: { boxWidth: 12, font: { size: 11 } }
                            }
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detailed Breakdown</CardTitle>
                  <CardDescription>All {competitorDimension === 'competitor' ? 'competitors' : competitorDimension === 'lost_reason' ? 'lost reasons' : 'lost remarks'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{competitorDimension === 'competitor' ? 'Competitor' : competitorDimension === 'lost_reason' ? 'Lost Reason' : 'Lost Remarks'}</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Total KVA</TableHead>
                        <TableHead className="text-right">States</TableHead>
                        <TableHead className="text-right">Dealers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitorAnalysis.analysis?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate" title={item.value}>
                            {item.value}
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{item.percentage}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.total_kva?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-right">{item.unique_states || 0}</TableCell>
                          <TableCell className="text-right">{item.unique_dealers || 0}</TableCell>
                        </TableRow>
                      ))}
                      {(!competitorAnalysis.analysis || competitorAnalysis.analysis.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No {competitorDimension} data available for lost leads
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Top by KVA */}
              {competitorAnalysis.top_by_kva?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top by KVA Lost</CardTitle>
                    <CardDescription>Highest value losses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {competitorAnalysis.top_by_kva.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-red-600">{idx + 1}</span>
                            <span className="font-medium">{item.value}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">{item.total_kva?.toLocaleString()} KVA</p>
                            <p className="text-sm text-muted-foreground">{item.count} leads</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No competitor analysis data available</p>
                <p className="text-sm">Make sure lost leads have competitor/reason data</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Closure Analysis Tab */}
        <TabsContent value="closure" className="space-y-6">
          {closureLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="h-96" />
            </div>
          ) : closureAnalysis ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Lost Leads</p>
                        <p className="text-2xl font-bold text-red-600">
                          {closureAnalysis.summary.total_lost_leads.toLocaleString()}
                        </p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">With Closure Data</p>
                        <p className="text-2xl font-bold text-green-600">
                          {(closureAnalysis.summary.leads_with_closure_data || 0).toLocaleString()}
                        </p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Closure</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {(closureAnalysis.summary.pending_closure || 0).toLocaleString()}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                        <p className={`text-2xl font-bold ${closureAnalysis.summary.completion_rate >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                          {closureAnalysis.summary.completion_rate}%
                        </p>
                      </div>
                      <Progress 
                        value={closureAnalysis.summary.completion_rate} 
                        className="w-16 h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Closure Questions Analysis (Competitor, Lost Reason, Lost Remarks) */}
              {closureAnalysis.question_analysis?.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {closureAnalysis.question_analysis.map((q, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary" />
                          {q.question}
                        </CardTitle>
                        <CardDescription>
                          {q.total_responses} responses
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {q.top_answers?.slice(0, 10).map((ans, ansIdx) => (
                            <div key={ansIdx} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="truncate max-w-[200px]" title={ans.answer}>
                                  {ans.answer || 'Not Answered'}
                                </span>
                                <span className="text-muted-foreground">
                                  {ans.count} ({ans.percentage}%)
                                </span>
                              </div>
                              <Progress value={ans.percentage} className="h-2" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-muted-foreground">
                      <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="font-medium mb-2">No Closure Data Yet</h3>
                      <p className="text-sm">
                        Upload Lost Leads with Competitor and Lost Reason data to see analysis here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lost by State & Dealer Tables */}
              {(closureAnalysis.by_state?.length > 0 || closureAnalysis.by_dealer?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By State */}
                  {closureAnalysis.by_state?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Lost by State</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>State</TableHead>
                              <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {closureAnalysis.by_state.slice(0, 10).map((s, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{s.state}</TableCell>
                                <TableCell className="text-right">{s.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* By Dealer */}
                  {closureAnalysis.by_dealer?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Lost by Dealer</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Dealer</TableHead>
                              <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {closureAnalysis.by_dealer.slice(0, 10).map((d, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{d.dealer}</TableCell>
                                <TableCell className="text-right">{d.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-medium mb-2">Failed to Load Closure Analysis</h3>
                  <p className="text-sm">Please try refreshing the page.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Summary Builder Tab */}
        <TabsContent value="summary" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Metric</label>
                <Select value={summaryMetric} onValueChange={setSummaryMetric}>
                  <SelectTrigger className="w-36" data-testid="summary-metric-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leads">Total Leads</SelectItem>
                    <SelectItem value="qty">Total Qty</SelectItem>
                    <SelectItem value="won_leads">Won Leads</SelectItem>
                    <SelectItem value="lost_leads">Lost Leads</SelectItem>
                    <SelectItem value="conversion_rate">Conversion %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Time Frame</label>
                <Select value={summaryTimeFrame} onValueChange={setSummaryTimeFrame}>
                  <SelectTrigger className="w-32" data-testid="summary-timeframe-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dimension</label>
                <Select value={summaryDimension} onValueChange={setSummaryDimension}>
                  <SelectTrigger className="w-32" data-testid="summary-dimension-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="dealer">Dealer</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="segment">Segment</SelectItem>
                    <SelectItem value="source">Source</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadSummaryBuilder}
                disabled={summaryLoading}
                className="mt-5"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${summaryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportSummaryToCSV}
              disabled={!summaryData?.pivot_table?.rows?.length}
              className="mt-5"
              data-testid="export-summary-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {summaryLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : summaryData?.pivot_table ? (
            <>
              {/* Insights Cards */}
              {summaryData.insights?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {summaryData.insights.map((insight, idx) => (
                    <Card key={idx} className={`
                      ${insight.type === 'top_performer' ? 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}
                      ${insight.type === 'trend' ? (insight.growth >= 0 ? 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10' : 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10') : ''}
                      ${insight.type === 'best_period' ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10' : ''}
                    `}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          {insight.type === 'top_performer' && <Trophy className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />}
                          {insight.type === 'trend' && (
                            insight.growth >= 0 
                              ? <TrendingUp className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                              : <TrendingDown className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          {insight.type === 'best_period' && <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
                          <div>
                            <p className="text-sm font-medium">
                              {insight.type === 'top_performer' && 'Top Performer'}
                              {insight.type === 'trend' && 'Trend'}
                              {insight.type === 'best_period' && 'Best Period'}
                            </p>
                            <p className="text-sm text-muted-foreground">{insight.message}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Pivot Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    {summaryMetric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} by {summaryDimension.charAt(0).toUpperCase() + summaryDimension.slice(1)}
                  </CardTitle>
                  <CardDescription>
                    {summaryTimeFrame.charAt(0).toUpperCase() + summaryTimeFrame.slice(1)} breakdown • {summaryData.meta?.date_range?.start_date} to {summaryData.meta?.date_range?.end_date}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold sticky left-0 bg-muted/50">
                            {summaryDimension.charAt(0).toUpperCase() + summaryDimension.slice(1)}
                          </TableHead>
                          {summaryData.pivot_table.columns.map(col => (
                            <TableHead key={col} className="text-right font-medium whitespace-nowrap">
                              {col}
                            </TableHead>
                          ))}
                          <TableHead className="text-right font-semibold bg-muted/80">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.pivot_table.rows.slice(0, 25).map((row, idx) => (
                          <TableRow key={idx} className={idx === 0 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                            <TableCell className="font-medium sticky left-0 bg-background max-w-[200px] truncate" title={row.dimension}>
                              <div className="flex items-center gap-2">
                                {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                                {row.dimension}
                              </div>
                            </TableCell>
                            {summaryData.pivot_table.columns.map(col => (
                              <TableCell key={col} className="text-right tabular-nums">
                                {summaryMetric === 'conversion_rate' 
                                  ? `${row.periods[col] || 0}%`
                                  : (row.periods[col] || 0).toLocaleString()
                                }
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-semibold bg-muted/30 tabular-nums">
                              {summaryMetric === 'conversion_rate'
                                ? `${row.total}%`
                                : row.total.toLocaleString()
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                        {summaryData.pivot_table.rows.length > 25 && (
                          <TableRow>
                            <TableCell colSpan={summaryData.pivot_table.columns.length + 2} className="text-center text-muted-foreground text-sm">
                              ... and {summaryData.pivot_table.rows.length - 25} more rows (export to CSV for full data)
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Column Totals Row */}
                        <TableRow className="bg-muted/50 font-semibold border-t-2">
                          <TableCell className="sticky left-0 bg-muted/50">Total</TableCell>
                          {summaryData.pivot_table.columns.map(col => (
                            <TableCell key={col} className="text-right tabular-nums">
                              {summaryMetric === 'conversion_rate'
                                ? `${summaryData.pivot_table.column_totals[col] || 0}%`
                                : (summaryData.pivot_table.column_totals[col] || 0).toLocaleString()
                              }
                            </TableCell>
                          ))}
                          <TableCell className="text-right bg-primary/10 tabular-nums">
                            {summaryMetric === 'conversion_rate'
                              ? `${summaryData.pivot_table.grand_total}%`
                              : summaryData.pivot_table.grand_total.toLocaleString()
                            }
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Bar Chart Visualization */}
              {summaryData.pivot_table.rows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Visual Breakdown</CardTitle>
                    <CardDescription>Top 10 {summaryDimension}s by {summaryMetric.replace('_', ' ')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <Bar
                        data={{
                          labels: summaryData.pivot_table.rows.slice(0, 10).map(r => 
                            r.dimension?.length > 15 ? r.dimension.substring(0, 15) + '...' : r.dimension
                          ),
                          datasets: [{
                            label: summaryMetric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            data: summaryData.pivot_table.rows.slice(0, 10).map(r => r.total),
                            backgroundColor: [
                              'rgba(99, 102, 241, 0.8)',
                              'rgba(34, 197, 94, 0.8)',
                              'rgba(249, 115, 22, 0.8)',
                              'rgba(236, 72, 153, 0.8)',
                              'rgba(139, 92, 246, 0.8)',
                              'rgba(6, 182, 212, 0.8)',
                              'rgba(245, 158, 11, 0.8)',
                              'rgba(239, 68, 68, 0.8)',
                              'rgba(20, 184, 166, 0.8)',
                              'rgba(168, 85, 247, 0.8)'
                            ],
                            borderWidth: 0
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y',
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const value = context.raw;
                                  return summaryMetric === 'conversion_rate' 
                                    ? `${value}%`
                                    : value.toLocaleString();
                                }
                              }
                            }
                          },
                          scales: {
                            x: { 
                              beginAtZero: true,
                              ticks: {
                                callback: (value) => summaryMetric === 'conversion_rate' ? `${value}%` : value.toLocaleString()
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No data available for the selected filters</p>
                <p className="text-sm">Try adjusting your date range or filters</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Insights;
