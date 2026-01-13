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
import { Trophy, Users, Building, MapPin, XCircle, AlertTriangle, CheckCircle2, HelpCircle, RefreshCw } from 'lucide-react';
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
                          {q.question}
                        </CardTitle>
                        <CardDescription>
                          {q.total_responses} responses
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {q.top_answers.map((ans, ansIdx) => (
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
              ) : null}

              {/* Competitor & Lost Reason Analysis Charts */}
              {(closureAnalysis.competitor_analysis?.length > 0 || closureAnalysis.lost_reason_analysis?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Competitor Chart */}
                  {closureAnalysis.competitor_analysis?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-red-500" />
                          Lost to Competitors
                        </CardTitle>
                        <CardDescription>Which competitors are winning deals</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px]">
                          <Pie
                            data={{
                              labels: closureAnalysis.competitor_analysis.slice(0, 8).map(c => c.competitor),
                              datasets: [{
                                data: closureAnalysis.competitor_analysis.slice(0, 8).map(c => c.count),
                                backgroundColor: [
                                  'hsl(0, 84%, 60%)',
                                  'hsl(30, 84%, 60%)',
                                  'hsl(60, 84%, 50%)',
                                  'hsl(120, 60%, 50%)',
                                  'hsl(180, 60%, 50%)',
                                  'hsl(210, 84%, 60%)',
                                  'hsl(270, 60%, 60%)',
                                  'hsl(330, 60%, 60%)'
                                ],
                                borderWidth: 1
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'right',
                                  labels: { boxWidth: 12, font: { size: 10 } }
                                }
                              }
                            }}
                          />
                        </div>
                        <Table className="mt-4">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Competitor</TableHead>
                              <TableHead className="text-right">Lost</TableHead>
                              <TableHead className="text-right">KVA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {closureAnalysis.competitor_analysis.slice(0, 6).map((c, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{c.competitor}</TableCell>
                                <TableCell className="text-right text-red-600">{c.count}</TableCell>
                                <TableCell className="text-right">{c.kva_lost?.toLocaleString() || 0}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Lost Reason Chart */}
                  {closureAnalysis.lost_reason_analysis?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          Lost Reasons
                        </CardTitle>
                        <CardDescription>Why leads are being lost</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px]">
                          <Pie
                            data={{
                              labels: closureAnalysis.lost_reason_analysis.slice(0, 8).map(r => r.reason),
                              datasets: [{
                                data: closureAnalysis.lost_reason_analysis.slice(0, 8).map(r => r.count),
                                backgroundColor: [
                                  'hsl(30, 84%, 55%)',
                                  'hsl(45, 84%, 55%)',
                                  'hsl(60, 70%, 50%)',
                                  'hsl(90, 60%, 50%)',
                                  'hsl(150, 60%, 50%)',
                                  'hsl(200, 70%, 55%)',
                                  'hsl(250, 60%, 55%)',
                                  'hsl(300, 50%, 55%)'
                                ],
                                borderWidth: 1
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'right',
                                  labels: { boxWidth: 12, font: { size: 10 } }
                                }
                              }
                            }}
                          />
                        </div>
                        <Table className="mt-4">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Reason</TableHead>
                              <TableHead className="text-right">Lost</TableHead>
                              <TableHead className="text-right">KVA</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {closureAnalysis.lost_reason_analysis.slice(0, 6).map((r, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{r.reason}</TableCell>
                                <TableCell className="text-right text-orange-600">{r.count}</TableCell>
                                <TableCell className="text-right">{r.kva_lost?.toLocaleString() || 0}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Empty state if no data */}
              {closureAnalysis.question_analysis.length === 0 && 
               (!closureAnalysis.competitor_analysis || closureAnalysis.competitor_analysis.length === 0) && 
               (!closureAnalysis.lost_reason_analysis || closureAnalysis.lost_reason_analysis.length === 0) && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-muted-foreground">
                      <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="font-medium mb-2">No Closure Data Yet</h3>
                      <p className="text-sm">
                        Closure question responses and competitor data will appear here once leads are marked as Lost.
                      </p>
                      <p className="text-sm mt-2">
                        Upload Lost Leads with competitor info or answer closure questions manually.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lost Leads by State and Dealer */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By State */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Lost Leads by State
                    </CardTitle>
                    <CardDescription>States with most lost leads</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {closureAnalysis.by_state.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>State</TableHead>
                            <TableHead className="text-right">Lost</TableHead>
                            <TableHead className="text-right">KVA Lost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {closureAnalysis.by_state.slice(0, 10).map((s, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{s.state}</TableCell>
                              <TableCell className="text-right text-red-600">{s.count}</TableCell>
                              <TableCell className="text-right">{s.kva_lost.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* By Dealer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Lost Leads by Dealer
                    </CardTitle>
                    <CardDescription>Dealers with most lost leads</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {closureAnalysis.by_dealer.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dealer</TableHead>
                            <TableHead className="text-right">Lost</TableHead>
                            <TableHead className="text-right">KVA Lost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {closureAnalysis.by_dealer.slice(0, 10).map((d, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium truncate max-w-[200px]">{d.dealer}</TableCell>
                              <TableCell className="text-right text-red-600">{d.count}</TableCell>
                              <TableCell className="text-right">{d.kva_lost.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Failed to load closure analysis data</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={loadClosureAnalysis}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Insights;
