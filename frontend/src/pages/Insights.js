import { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trophy, Users, Building, MapPin, XCircle, AlertTriangle, CheckCircle2, HelpCircle, RefreshCw, LayoutGrid, TrendingUp, TrendingDown, Lightbulb, Download, History, ArrowUpRight, ArrowDownRight, Minus, Globe, Zap, ChevronRight, ArrowLeft, Flame, Clock } from 'lucide-react';
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

// Import refactored components
import { SummaryBuilder, TopPerformers, TemperatureAnalysis, LeadAgeAnalysis } from '@/components/insights';

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
  const [conversionData, setConversionData] = useState([]);
  const [segmentData, setSegmentData] = useState([]);
  const [segmentCompareYoy, setSegmentCompareYoy] = useState(false);
  const [closureAnalysis, setClosureAnalysis] = useState(null);
  const [closureCompareYoy, setClosureCompareYoy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closureLoading, setClosureLoading] = useState(false);
  
  // Competitor Analysis state
  const [competitorDimension, setCompetitorDimension] = useState('competitor');
  const [competitorAnalysis, setCompetitorAnalysis] = useState(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);

  // Source Analysis state
  const [sourceData, setSourceData] = useState([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceCompareYoy, setSourceCompareYoy] = useState(false);
  
  // KVA Analysis state
  const [kvaData, setKvaData] = useState([]);
  const [kvaLoading, setKvaLoading] = useState(false);
  const [kvaCompareYoy, setKvaCompareYoy] = useState(false);
  
  // Drill-down state
  const [drilldownData, setDrilldownData] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownPath, setDrilldownPath] = useState([]); // Breadcrumb path

  useEffect(() => {
    loadData();
  }, [buildQueryParams]);

  useEffect(() => {
    loadClosureAnalysis();
    loadCompetitorAnalysis();
    loadSourceAnalysis();
    loadKvaAnalysis();
  }, [buildQueryParams]);

  useEffect(() => {
    loadCompetitorAnalysis();
  }, [competitorDimension]);

  useEffect(() => {
    loadSourceAnalysis();
  }, [sourceCompareYoy]);

  useEffect(() => {
    loadKvaAnalysis();
  }, [kvaCompareYoy]);

  useEffect(() => {
    loadSegmentAnalysis();
  }, [segmentCompareYoy]);

  useEffect(() => {
    loadClosureAnalysis();
  }, [closureCompareYoy]);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      const [conversionRes, segmentRes] = await Promise.all([
        axios.get(`${API}/insights/conversion-vs-followups?${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/insights/segment-analysis?${queryParams}&compare_yoy=${segmentCompareYoy}`, { withCredentials: true })
      ]);
      setConversionData(conversionRes.data.data || []);
      setSegmentData(segmentRes.data.segments || []);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSegmentAnalysis = async () => {
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/segment-analysis?${queryParams}&compare_yoy=${segmentCompareYoy}`, { withCredentials: true });
      setSegmentData(res.data.segments || []);
    } catch (error) {
      console.error('Error loading segment analysis:', error);
    }
  };

  const loadClosureAnalysis = async () => {
    setClosureLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/closure-analysis?${queryParams}&compare_yoy=${closureCompareYoy}`, { withCredentials: true });
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
        `${API}/insights/summary-builder?metric=${summaryMetric}&time_frame=${summaryTimeFrame}&dimension=${summaryDimension}&compare_historical=${compareHistorical}&${queryParams}`,
        { withCredentials: true }
      );
      setSummaryData(res.data);
    } catch (error) {
      console.error('Error loading summary builder:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadSourceAnalysis = async () => {
    setSourceLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/source-analysis?${queryParams}&compare_yoy=${sourceCompareYoy}`, { withCredentials: true });
      setSourceData(res.data.sources || []);
    } catch (error) {
      console.error('Error loading source analysis:', error);
    } finally {
      setSourceLoading(false);
    }
  };

  const loadKvaAnalysis = async () => {
    setKvaLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/kva-analysis?${queryParams}&compare_yoy=${kvaCompareYoy}`, { withCredentials: true });
      setKvaData(res.data.categories || []);
    } catch (error) {
      console.error('Error loading KVA analysis:', error);
    } finally {
      setKvaLoading(false);
    }
  };

  const loadTemperatureAnalysis = async () => {
    setTemperatureLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/temperature-analysis?${queryParams}&dimension=${temperatureDimension}`, { withCredentials: true });
      setTemperatureData(res.data);
    } catch (error) {
      console.error('Error loading temperature analysis:', error);
    } finally {
      setTemperatureLoading(false);
    }
  };

  const loadLeadAgeAnalysis = async () => {
    setLeadAgeLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/insights/lead-age-analysis?${queryParams}&dimension=${leadAgeDimension}`, { withCredentials: true });
      setLeadAgeData(res.data);
    } catch (error) {
      console.error('Error loading lead age analysis:', error);
    } finally {
      setLeadAgeLoading(false);
    }
  };

  const loadDrilldown = async (analysisType, level, value, parentDealer, parentDistrict) => {
    setDrilldownLoading(true);
    try {
      const queryParams = buildQueryParams();
      let url = `${API}/insights/analysis-drilldown?analysis_type=${analysisType}&level=${level}&${queryParams}`;
      if (value) url += `&value=${encodeURIComponent(value)}`;
      if (parentDealer) url += `&parent_dealer=${encodeURIComponent(parentDealer)}`;
      if (parentDistrict) url += `&parent_district=${encodeURIComponent(parentDistrict)}`;
      
      const res = await axios.get(url, { withCredentials: true });
      setDrilldownData(res.data);
    } catch (error) {
      console.error('Error loading drilldown:', error);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleDrilldown = (analysisType, item, currentLevel = 1) => {
    const newPath = [...drilldownPath];
    
    if (currentLevel === 1) {
      // Starting fresh drilldown
      newPath.length = 0;
      newPath.push({ level: 1, label: item.name || item.segment || item.source || item.category, value: item.name || item.segment || item.source || item.category });
      loadDrilldown(analysisType, 2, item.name || item.segment || item.source || item.category, null, null);
    } else if (currentLevel === 2) {
      // Drilldown from dealer to district
      newPath.push({ level: 2, label: item.name, value: item.name, type: 'dealer' });
      loadDrilldown(analysisType, 3, drilldownPath[0]?.value, item.name, null);
    } else if (currentLevel === 3) {
      // Drilldown from district to employee
      newPath.push({ level: 3, label: item.name, value: item.name, type: 'district' });
      const parentDealer = drilldownPath.find(p => p.type === 'dealer')?.value;
      loadDrilldown(analysisType, 4, drilldownPath[0]?.value, parentDealer, item.name);
    }
    
    setDrilldownPath(newPath);
  };

  const resetDrilldown = () => {
    setDrilldownData(null);
    setDrilldownPath([]);
  };

  const goBackDrilldown = (toLevel) => {
    const newPath = drilldownPath.slice(0, toLevel);
    setDrilldownPath(newPath);
    
    if (toLevel === 0) {
      setDrilldownData(null);
    } else {
      const analysisType = drilldownData?.analysis_type;
      const value = newPath[0]?.value;
      const parentDealer = newPath.find(p => p.type === 'dealer')?.value;
      const parentDistrict = newPath.find(p => p.type === 'district')?.value;
      loadDrilldown(analysisType, toLevel + 1, value, parentDealer, parentDistrict);
    }
  };

  // Load summary builder when params change
  useEffect(() => {
    loadSummaryBuilder();
  }, [buildQueryParams, summaryMetric, summaryTimeFrame, summaryDimension, compareHistorical]);

  const exportSummaryToExcel = () => {
    if (!summaryData?.pivot_table) return;
    
    const dimension = summaryData.meta.dimension;
    let exportData = [];
    
    // Check if we have historical comparison data
    if (compareHistorical && summaryData.historical_comparison) {
      const { columns, rows, column_totals, grand_total } = summaryData.historical_comparison;
      
      // Build header row
      let headerRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: '' };
      columns.forEach(col => {
        headerRow[`${col.current} (Current)`] = '';
        headerRow[`${col.historical || 'N/A'} (Prev)`] = '';
        headerRow[`${col.current} YoY %`] = '';
      });
      headerRow['Total (Current)'] = '';
      headerRow['Total (Prev)'] = '';
      headerRow['Total YoY %'] = '';
      
      // Build data rows
      rows.forEach(row => {
        let dataRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: row.dimension };
        columns.forEach(col => {
          const periodData = row.periods[col.current] || { current: 0, historical: 0, yoy_change: 0 };
          dataRow[`${col.current} (Current)`] = periodData.current;
          dataRow[`${col.historical || 'N/A'} (Prev)`] = periodData.historical;
          dataRow[`${col.current} YoY %`] = periodData.yoy_change;
        });
        dataRow['Total (Current)'] = row.total;
        dataRow['Total (Prev)'] = row.hist_total;
        dataRow['Total YoY %'] = row.yoy_change;
        exportData.push(dataRow);
      });
      
      // Add totals row
      let totalRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: 'Total' };
      columns.forEach(col => {
        const totals = column_totals[col.current] || { current: 0, historical: 0, yoy_change: 0 };
        totalRow[`${col.current} (Current)`] = totals.current;
        totalRow[`${col.historical || 'N/A'} (Prev)`] = totals.historical;
        totalRow[`${col.current} YoY %`] = totals.yoy_change;
      });
      totalRow['Total (Current)'] = grand_total.current;
      totalRow['Total (Prev)'] = grand_total.historical;
      totalRow['Total YoY %'] = grand_total.yoy_change;
      exportData.push(totalRow);
    } else {
      const { columns, rows, column_totals, grand_total } = summaryData.pivot_table;
      
      // Build data rows
      rows.forEach(row => {
        let dataRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: row.dimension };
        columns.forEach(col => {
          dataRow[col] = row.periods[col] || 0;
        });
        dataRow['Total'] = row.total;
        exportData.push(dataRow);
      });
      
      // Add totals row
      let totalRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: 'Total' };
      columns.forEach(col => {
        totalRow[col] = column_totals[col] || 0;
      });
      totalRow['Total'] = grand_total;
      exportData.push(totalRow);
    }
    
    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    
    // Download Excel file
    const filename = compareHistorical 
      ? `summary_${summaryDimension}_${summaryMetric}_${summaryTimeFrame}_yoy.xlsx`
      : `summary_${summaryDimension}_${summaryMetric}_${summaryTimeFrame}.xlsx`;
    XLSX.writeFile(wb, filename);
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
  const maxValue = Math.max(...performers.map(p => p[metric === 'conversion_rate' ? 'conversion_rate' : metric === 'won' ? 'won_leads' : 'total_leads']));

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
          <TabsTrigger value="source" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Source Analysis
          </TabsTrigger>
          <TabsTrigger value="kva" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            KVA Analysis
          </TabsTrigger>
          <TabsTrigger value="temperature" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Hot/Warm/Cold
          </TabsTrigger>
          <TabsTrigger value="leadage" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Lead Age
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Summary Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performers" className="space-y-4">
          <TopPerformers buildQueryParams={buildQueryParams} />
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Segment Performance</CardTitle>
                  <p className="text-sm text-muted-foreground">Click on any segment to drill down into dealers</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="segment-yoy"
                    checked={segmentCompareYoy}
                    onCheckedChange={setSegmentCompareYoy}
                  />
                  <Label htmlFor="segment-yoy" className="text-sm">Compare YoY</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {drilldownData && drilldownData.analysis_type === 'segment' ? (
                // Drilldown view
                <div className="space-y-4">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-sm">
                    <Button variant="ghost" size="sm" onClick={resetDrilldown} className="h-7 px-2">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to Segments
                    </Button>
                    {drilldownPath.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => goBackDrilldown(idx)}
                        >
                          {item.label}
                        </Button>
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing {drilldownData.level_label}s for <strong>{drilldownPath[0]?.label}</strong>
                    {drilldownData.next_level_label && ` • Click to drill into ${drilldownData.next_level_label}s`}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{drilldownData.level_label}</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                        <TableHead className="text-right">Conv. Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownData.data.map((item, idx) => (
                        <TableRow 
                          key={idx} 
                          className={drilldownData.next_level ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => drilldownData.next_level && handleDrilldown('segment', item, drilldownData.level)}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {item.name}
                            {drilldownData.next_level && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="text-right">{item.total}</TableCell>
                          <TableCell className="text-right text-green-600">{item.won}</TableCell>
                          <TableCell className="text-right text-red-600">{item.lost}</TableCell>
                          <TableCell className="text-right text-yellow-600">{item.open}</TableCell>
                          <TableCell className="text-right">{item.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                      {drilldownData.data.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No data available at this level
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // Main segment view
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {segmentCompareYoy && <TableHead className="text-right">LY Total</TableHead>}
                      {segmentCompareYoy && <TableHead className="text-right">YoY %</TableHead>}
                      <TableHead className="text-right">Won</TableHead>
                      {segmentCompareYoy && <TableHead className="text-right">LY Won</TableHead>}
                      {segmentCompareYoy && <TableHead className="text-right">Won YoY</TableHead>}
                      <TableHead className="text-right">Lost</TableHead>
                      <TableHead className="text-right">Conv. Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {segmentData.map((s, idx) => (
                      <TableRow 
                        key={idx}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleDrilldown('segment', { name: s.segment }, 1)}
                      >
                        <TableCell className="font-medium flex items-center gap-2">
                          {s.segment}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="text-right">{s.total_leads}</TableCell>
                        {segmentCompareYoy && <TableCell className="text-right text-muted-foreground">{s.ly_total_leads || 0}</TableCell>}
                        {segmentCompareYoy && (
                          <TableCell className="text-right">
                            <span className={s.yoy_total_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.yoy_total_change >= 0 ? '+' : ''}{s.yoy_total_change || 0}%
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-right text-green-600">{s.won_leads}</TableCell>
                        {segmentCompareYoy && <TableCell className="text-right text-muted-foreground">{s.ly_won_leads || 0}</TableCell>}
                        {segmentCompareYoy && (
                          <TableCell className="text-right">
                            <span className={s.yoy_won_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.yoy_won_change >= 0 ? '+' : ''}{s.yoy_won_change || 0}%
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-right text-red-600">{s.lost_leads}</TableCell>
                        <TableCell className="text-right">{s.conversion_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {segmentData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={segmentCompareYoy ? 10 : 6} className="text-center text-muted-foreground py-8">
                          No segment data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
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
                          <TableCell className="text-right">{item.unique_states || 0}</TableCell>
                          <TableCell className="text-right">{item.unique_dealers || 0}</TableCell>
                        </TableRow>
                      ))}
                      {(!competitorAnalysis.analysis || competitorAnalysis.analysis.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No {competitorDimension} data available for lost leads
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Top by Count */}
              {competitorAnalysis.top_by_kva?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top by Lost Count</CardTitle>
                    <CardDescription>Highest loss counts</CardDescription>
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
                            <p className="font-bold text-red-600">{item.count} leads</p>
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
          {/* YoY Toggle */}
          <div className="flex items-center justify-end gap-2">
            <Switch
              id="closure-yoy"
              checked={closureCompareYoy}
              onCheckedChange={setClosureCompareYoy}
            />
            <Label htmlFor="closure-yoy" className="text-sm">Compare YoY</Label>
          </div>
          
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
                        {closureCompareYoy && closureAnalysis.summary.ly_total_lost !== null && (
                          <p className="text-xs text-muted-foreground">
                            LY: {closureAnalysis.summary.ly_total_lost?.toLocaleString()} 
                            <span className={`ml-1 ${closureAnalysis.summary.yoy_change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ({closureAnalysis.summary.yoy_change >= 0 ? '+' : ''}{closureAnalysis.summary.yoy_change}%)
                            </span>
                          </p>
                        )}
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
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    {ans.count} ({ans.percentage}%)
                                  </span>
                                  {closureCompareYoy && ans.yoy_change !== undefined && (
                                    <span className={`text-xs ${ans.yoy_change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {ans.yoy_change >= 0 ? '+' : ''}{ans.yoy_change}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Progress value={ans.percentage} className="h-2" />
                              {closureCompareYoy && ans.ly_count !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                  LY: {ans.ly_count}
                                </p>
                              )}
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

        {/* Source Analysis Tab */}
        <TabsContent value="source" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Source Performance
                  </CardTitle>
                  <CardDescription>Lead performance by source channel</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="source-yoy"
                      checked={sourceCompareYoy}
                      onCheckedChange={setSourceCompareYoy}
                    />
                    <Label htmlFor="source-yoy" className="text-sm">Compare YoY</Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadSourceAnalysis} disabled={sourceLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${sourceLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sourceLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : drilldownData && drilldownData.analysis_type === 'source' ? (
                // Drilldown view
                <div className="space-y-4">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-sm">
                    <Button variant="ghost" size="sm" onClick={resetDrilldown} className="h-7 px-2">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to Sources
                    </Button>
                    {drilldownPath.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => goBackDrilldown(idx)}
                        >
                          {item.label}
                        </Button>
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing {drilldownData.level_label}s for <strong>{drilldownPath[0]?.label}</strong>
                    {drilldownData.next_level_label && ` • Click to drill into ${drilldownData.next_level_label}s`}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{drilldownData.level_label}</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                        <TableHead className="text-right">Conv. Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownData.data.map((item, idx) => (
                        <TableRow 
                          key={idx} 
                          className={drilldownData.next_level ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => drilldownData.next_level && handleDrilldown('source', item, drilldownData.level)}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {item.name}
                            {drilldownData.next_level && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="text-right">{item.total}</TableCell>
                          <TableCell className="text-right text-green-600">{item.won}</TableCell>
                          <TableCell className="text-right text-red-600">{item.lost}</TableCell>
                          <TableCell className="text-right text-yellow-600">{item.open}</TableCell>
                          <TableCell className="text-right">{item.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                      {drilldownData.data.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No data available at this level
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // Main source view
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {sourceCompareYoy && <TableHead className="text-right">LY Total</TableHead>}
                      {sourceCompareYoy && <TableHead className="text-right">YoY %</TableHead>}
                      <TableHead className="text-right">Won</TableHead>
                      {sourceCompareYoy && <TableHead className="text-right">LY Won</TableHead>}
                      {sourceCompareYoy && <TableHead className="text-right">Won YoY</TableHead>}
                      <TableHead className="text-right">Lost</TableHead>
                      <TableHead className="text-right">Conv. Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceData.map((s, idx) => (
                      <TableRow 
                        key={idx} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleDrilldown('source', { name: s.source }, 1)}
                      >
                        <TableCell className="font-medium flex items-center gap-2">
                          {s.source}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="text-right">{s.total_leads}</TableCell>
                        {sourceCompareYoy && <TableCell className="text-right text-muted-foreground">{s.ly_total_leads || 0}</TableCell>}
                        {sourceCompareYoy && (
                          <TableCell className="text-right">
                            <span className={s.yoy_total_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.yoy_total_change >= 0 ? '+' : ''}{s.yoy_total_change || 0}%
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-right text-green-600">{s.won_leads}</TableCell>
                        {sourceCompareYoy && <TableCell className="text-right text-muted-foreground">{s.ly_won_leads || 0}</TableCell>}
                        {sourceCompareYoy && (
                          <TableCell className="text-right">
                            <span className={s.yoy_won_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.yoy_won_change >= 0 ? '+' : ''}{s.yoy_won_change || 0}%
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-right text-red-600">{s.lost_leads}</TableCell>
                        <TableCell className="text-right">{s.conversion_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {sourceData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={sourceCompareYoy ? 10 : 6} className="text-center text-muted-foreground py-8">
                          No source data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KVA Analysis Tab */}
        <TabsContent value="kva" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-500" />
                    KVA Category Analysis
                  </CardTitle>
                  <CardDescription>Lead performance by KVA range (LKVA/MKVA/HKVA)</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="kva-yoy"
                      checked={kvaCompareYoy}
                      onCheckedChange={setKvaCompareYoy}
                    />
                    <Label htmlFor="kva-yoy" className="text-sm">Compare YoY</Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadKvaAnalysis} disabled={kvaLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${kvaLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {kvaLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : drilldownData && drilldownData.analysis_type === 'kva' ? (
                // Drilldown view
                <div className="space-y-4">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-sm">
                    <Button variant="ghost" size="sm" onClick={resetDrilldown} className="h-7 px-2">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to Categories
                    </Button>
                    {drilldownPath.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2"
                          onClick={() => goBackDrilldown(idx)}
                        >
                          {item.label}
                        </Button>
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing {drilldownData.level_label}s for <strong>{drilldownPath[0]?.label}</strong>
                    {drilldownData.next_level_label && ` • Click to drill into ${drilldownData.next_level_label}s`}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{drilldownData.level_label}</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                        <TableHead className="text-right">Conv. Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownData.data.map((item, idx) => (
                        <TableRow 
                          key={idx} 
                          className={drilldownData.next_level ? 'cursor-pointer hover:bg-muted/50' : ''}
                          onClick={() => drilldownData.next_level && handleDrilldown('kva', item, drilldownData.level)}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {item.name}
                            {drilldownData.next_level && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="text-right">{item.total}</TableCell>
                          <TableCell className="text-right text-green-600">{item.won}</TableCell>
                          <TableCell className="text-right text-red-600">{item.lost}</TableCell>
                          <TableCell className="text-right text-yellow-600">{item.open}</TableCell>
                          <TableCell className="text-right">{item.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                      {drilldownData.data.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No data available at this level
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // Main KVA category cards
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {kvaData.map((cat, idx) => (
                      <Card 
                        key={idx} 
                        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                        style={{ borderLeftColor: cat.color }}
                        onClick={() => handleDrilldown('kva', { name: cat.category }, 1)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-lg">{cat.category}</span>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total:</span>
                              <span className="ml-1 font-medium">{cat.total_leads}</span>
                              {kvaCompareYoy && cat.yoy_total_change !== undefined && (
                                <span className={`ml-1 text-xs ${cat.yoy_total_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({cat.yoy_total_change >= 0 ? '+' : ''}{cat.yoy_total_change}%)
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Open:</span>
                              <span className="ml-1 font-medium text-yellow-600">{cat.open_leads}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Won:</span>
                              <span className="ml-1 font-medium text-green-600">{cat.won_leads}</span>
                              {kvaCompareYoy && cat.yoy_won_change !== undefined && (
                                <span className={`ml-1 text-xs ${cat.yoy_won_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({cat.yoy_won_change >= 0 ? '+' : ''}{cat.yoy_won_change}%)
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Lost:</span>
                              <span className="ml-1 font-medium text-red-600">{cat.lost_leads}</span>
                            </div>
                          </div>
                          {kvaCompareYoy && cat.ly_total_leads !== undefined && (
                            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                              Last Year: {cat.ly_total_leads} total, {cat.ly_won_leads} won
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Conversion Rate</span>
                              <span className="font-semibold">{cat.conversion_rate}%</span>
                            </div>
                            <Progress value={cat.conversion_rate} className="mt-1 h-2" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {kvaData.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No KVA data available
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Temperature (Hot/Warm/Cold) Analysis Tab */}
        <TabsContent value="temperature" className="space-y-6">
          <TemperatureAnalysis buildQueryParams={buildQueryParams} />
        </TabsContent>
        {/* Lead Age Analysis Tab */}
        <TabsContent value="leadage" className="space-y-6">
          <LeadAgeAnalysis buildQueryParams={buildQueryParams} />
        </TabsContent>
        {/* Summary Builder Tab */}
        <TabsContent value="summary" className="space-y-6">
          <SummaryBuilder buildQueryParams={buildQueryParams} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Insights;
