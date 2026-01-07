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
import { Line, Bar, Doughnut } from 'react-chartjs-2';

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
                          {closureAnalysis.summary.leads_with_closure_answers.toLocaleString()}
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
                        <p className="text-sm text-muted-foreground">Pending Answers</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {closureAnalysis.summary.pending_closure_questions.toLocaleString()}
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
                        <p className={`text-2xl font-bold ${closureAnalysis.summary.completion_rate >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
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

              {/* Question Analysis */}
              {closureAnalysis.question_analysis.length > 0 ? (
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
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-muted-foreground">
                      <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="font-medium mb-2">No Closure Data Yet</h3>
                      <p className="text-sm">
                        Closure question responses will appear here once leads are marked as Lost and questions are answered.
                      </p>
                      <p className="text-sm mt-2">
                        Configure closure questions in <span className="font-medium">Admin Settings → Closure Questions</span>
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
