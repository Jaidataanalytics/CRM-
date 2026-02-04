import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Download, TrendingUp, TrendingDown, MapPin, Building2, 
  Users, Layers, Calendar, BarChart3, ChevronDown, ChevronRight,
  Sun, CloudRain, Target, ArrowRight, Clock, Zap, Map
} from 'lucide-react';
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
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const API = '/api';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

// ============================================
// MONTHLY DETAILED FORECAST COMPONENT (NEW)
// ============================================
export const MonthlyForecastView = ({ monthsAhead = 3, includeCurrentMonth = true }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [expandedDealer, setExpandedDealer] = useState(null);
  const [viewMode, setViewMode] = useState('overview'); // overview, dealer, kva, district

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/forecast-enhanced/monthly-forecast?months_ahead=${monthsAhead}&include_current_month=${includeCurrentMonth}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setData(res.data);
        // Auto-select first month
        if (res.data.monthly_forecasts?.length > 0) {
          setSelectedMonth(res.data.monthly_forecasts[0].month);
        }
      }
    } catch (err) {
      toast.error('Failed to load monthly forecast');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [monthsAhead, includeCurrentMonth]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading monthly forecast...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const selectedMonthData = data.monthly_forecasts?.find(mf => mf.month === selectedMonth);

  // Chart: Monthly totals bar chart
  const monthlyTotalsChart = {
    labels: data.monthly_forecasts?.map(mf => mf.month_name) || [],
    datasets: [{
      label: 'Predicted Units',
      data: data.monthly_forecasts?.map(mf => mf.total_units) || [],
      backgroundColor: data.monthly_forecasts?.map((mf, i) => 
        mf.is_current_month ? '#f59e0b' : COLORS[i % COLORS.length]
      ) || [],
      borderRadius: 6
    }]
  };

  // Chart: Top dealers by month
  const topDealers = [...new Set(
    data.monthly_forecasts?.flatMap(mf => 
      mf.dealer_breakdown?.slice(0, 5).map(d => d.dealer) || []
    )
  )].slice(0, 5);

  const dealerMonthlyChart = {
    labels: data.monthly_forecasts?.map(mf => mf.month_name) || [],
    datasets: topDealers.map((dealer, idx) => ({
      label: dealer,
      data: data.monthly_forecasts?.map(mf => {
        const d = mf.dealer_breakdown?.find(db => db.dealer === dealer);
        return d?.total_units || 0;
      }) || [],
      backgroundColor: COLORS[idx % COLORS.length],
      borderRadius: 4
    }))
  };

  // Chart: KVA distribution for selected month
  const kvaChartData = selectedMonthData ? {
    labels: Object.keys(selectedMonthData.kva_totals || {}).slice(0, 10).map(k => `${k} KVA`),
    datasets: [{
      label: `Units in ${selectedMonthData.month_name}`,
      data: Object.values(selectedMonthData.kva_totals || {}).slice(0, 10),
      backgroundColor: COLORS.slice(0, 10),
      borderRadius: 6
    }]
  } : null;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Months Predicted</p>
                <p className="text-2xl font-bold text-indigo-700">{data.summary?.months_predicted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Layers className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Units</p>
                <p className="text-2xl font-bold text-green-700">{data.grand_total_units}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Dealers</p>
                <p className="text-2xl font-bold text-amber-700">{data.summary?.total_dealers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Districts</p>
                <p className="text-2xl font-bold text-purple-700">{data.summary?.total_districts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Indicator */}
      {data.include_current_month && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-600" />
          <span className="text-amber-800">
            <strong>Current month ({data.current_month})</strong> prediction included - based on historical patterns, excluding this month's actual data
          </span>
        </div>
      )}

      {/* Monthly Overview Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Monthly Forecast Overview
          </CardTitle>
          <CardDescription>
            Predicted units for each month (current month highlighted in amber)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Bar
              data={monthlyTotalsChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: 'Units' } }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Top Dealers Monthly Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            Top Dealers - Monthly Comparison
          </CardTitle>
          <CardDescription>How top dealers perform across predicted months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <Bar
              data={dealerMonthlyChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                  x: { stacked: false },
                  y: { beginAtZero: true, title: { display: true, text: 'Units' } }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Month Selector Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            Detailed Monthly Breakdown
          </CardTitle>
          <CardDescription>Select a month to see dealer/KVA/district breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
            <TabsList className="mb-4">
              {data.monthly_forecasts?.map(mf => (
                <TabsTrigger 
                  key={mf.month} 
                  value={mf.month}
                  className={mf.is_current_month ? 'border-amber-400 border-2' : ''}
                >
                  {mf.month_name}
                  {mf.is_current_month && <Sun className="w-3 h-3 ml-1 text-amber-500" />}
                </TabsTrigger>
              ))}
            </TabsList>

            {data.monthly_forecasts?.map(mf => (
              <TabsContent key={mf.month} value={mf.month}>
                {/* Month Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Total Units</p>
                    <p className="text-3xl font-bold text-gray-900">{mf.total_units}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Seasonality Factor</p>
                    <p className="text-3xl font-bold text-gray-900">{mf.seasonality_factor}x</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Active Dealers</p>
                    <p className="text-3xl font-bold text-gray-900">{mf.dealer_breakdown?.length || 0}</p>
                  </div>
                </div>

                {/* KVA Chart for this month */}
                {kvaChartData && selectedMonth === mf.month && (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> KVA Distribution for {mf.month_name}
                    </h4>
                    <div className="h-48">
                      <Bar
                        data={kvaChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true } }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Dealer Breakdown Table */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Dealer Breakdown
                  </h4>
                  {mf.dealer_breakdown?.map((dealer, idx) => (
                    <Collapsible
                      key={dealer.dealer}
                      open={expandedDealer === `${mf.month}-${idx}`}
                      onOpenChange={() => setExpandedDealer(
                        expandedDealer === `${mf.month}-${idx}` ? null : `${mf.month}-${idx}`
                      )}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedDealer === `${mf.month}-${idx}` ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <span className="font-medium">{dealer.dealer}</span>
                          </div>
                          <Badge variant="secondary">{dealer.total_units} units</Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-7 mt-2 p-3 bg-white border rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* KVA Breakdown */}
                            <div>
                              <h5 className="text-sm font-medium mb-2 text-gray-600">By KVA</h5>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>KVA</TableHead>
                                    <TableHead className="text-right">Units</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {dealer.kva_breakdown?.slice(0, 5).map((kva, kvaIdx) => (
                                    <TableRow key={kvaIdx}>
                                      <TableCell>{kva.kva} KVA</TableCell>
                                      <TableCell className="text-right">{kva.predicted_units}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {/* District Breakdown */}
                            <div>
                              <h5 className="text-sm font-medium mb-2 text-gray-600">By District</h5>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>District</TableHead>
                                    <TableHead className="text-right">Units</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {dealer.district_breakdown?.slice(0, 5).map((dist, distIdx) => (
                                    <TableRow key={distIdx}>
                                      <TableCell>{dist.district}</TableCell>
                                      <TableCell className="text-right">{dist.predicted_units}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================
// DEALER-KVA FORECAST COMPONENT
// ============================================
export const DealerKvaForecast = ({ monthsAhead = 3 }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedDealer, setExpandedDealer] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/forecast-enhanced/dealer-kva-forecast?months_ahead=${monthsAhead}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load dealer-KVA forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [monthsAhead]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading dealer-KVA forecast...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const chartData = {
    labels: data.kva_summary?.slice(0, 10).map(k => `${k.kva} KVA`) || [],
    datasets: [{
      label: 'Predicted Units',
      data: data.kva_summary?.slice(0, 10).map(k => k.total_units) || [],
      backgroundColor: COLORS.slice(0, 10),
      borderRadius: 6
    }]
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Dealers</p>
                <p className="text-2xl font-bold text-indigo-700">{data.dealer_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Layers className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Predicted Units</p>
                <p className="text-2xl font-bold text-green-700">{data.grand_total_units}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Forecast Horizon</p>
                <p className="text-2xl font-bold text-amber-700">{data.forecast_horizon_months} months</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KVA Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            KVA Distribution Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: 'Units' } }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dealer Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            Dealer-wise KVA Breakdown
          </CardTitle>
          <CardDescription>Click on a dealer to expand KVA details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.dealer_forecasts?.map((dealer, idx) => (
              <Collapsible
                key={dealer.dealer}
                open={expandedDealer === idx}
                onOpenChange={() => setExpandedDealer(expandedDealer === idx ? null : idx)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedDealer === idx ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="font-medium">{dealer.dealer}</span>
                    </div>
                    <Badge variant="secondary">
                      {dealer.total_units} units
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-7 mt-2 p-3 bg-white border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>KVA</TableHead>
                          <TableHead className="text-right">Predicted Units</TableHead>
                          <TableHead className="text-right">Avg Monthly</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dealer.kva_breakdown?.map((kva, kvaIdx) => (
                          <TableRow key={kvaIdx}>
                            <TableCell className="font-medium">{kva.kva} KVA</TableCell>
                            <TableCell className="text-right">{kva.predicted_units}</TableCell>
                            <TableCell className="text-right">{kva.avg_monthly}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================
// DEALER-DISTRICT FORECAST COMPONENT
// ============================================
export const DealerDistrictForecast = ({ monthsAhead = 3 }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedDealer, setExpandedDealer] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/forecast-enhanced/dealer-district-forecast?months_ahead=${monthsAhead}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load dealer-district forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [monthsAhead]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading dealer-district forecast...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const topDistricts = data.district_summary?.slice(0, 10) || [];
  const chartData = {
    labels: topDistricts.map(d => d.district),
    datasets: [{
      label: 'Predicted Units',
      data: topDistricts.map(d => d.total_units),
      backgroundColor: COLORS.slice(0, 10),
      borderRadius: 6
    }]
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Districts Covered</p>
                <p className="text-2xl font-bold text-green-700">{data.district_summary?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Predicted Units</p>
                <p className="text-2xl font-bold text-blue-700">{data.grand_total_units}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Dealers</p>
                <p className="text-2xl font-bold text-purple-700">{data.dealer_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Districts Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="w-5 h-5 text-green-500" />
            Top 10 Districts by Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                  x: { beginAtZero: true, title: { display: true, text: 'Units' } }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dealer Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-500" />
            Dealer-wise District Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.dealer_forecasts?.map((dealer, idx) => (
              <Collapsible
                key={dealer.dealer}
                open={expandedDealer === idx}
                onOpenChange={() => setExpandedDealer(expandedDealer === idx ? null : idx)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedDealer === idx ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="font-medium">{dealer.dealer}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{dealer.district_breakdown?.length || 0} districts</Badge>
                      <Badge variant="secondary">{dealer.total_units} units</Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-7 mt-2 p-3 bg-white border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>District</TableHead>
                          <TableHead className="text-right">Predicted Units</TableHead>
                          <TableHead className="text-right">Avg Monthly</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dealer.district_breakdown?.map((dist, distIdx) => (
                          <TableRow key={distIdx}>
                            <TableCell className="font-medium">{dist.district}</TableCell>
                            <TableCell className="text-right">{dist.predicted_units}</TableCell>
                            <TableCell className="text-right">{dist.avg_monthly}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================
// SEASONALITY ANALYSIS COMPONENT
// ============================================
export const SeasonalityAnalysis = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/forecast-enhanced/seasonality-analysis`, { withCredentials: true });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load seasonality analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading seasonality analysis...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const chartData = {
    labels: data.seasonality?.map(s => s.month_name.substring(0, 3)) || [],
    datasets: [
      {
        label: 'Avg Leads',
        data: data.seasonality?.map(s => s.avg_leads) || [],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Avg Won',
        data: data.seasonality?.map(s => s.avg_won) || [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const getSeasonIcon = (index) => {
    if (index > 110) return <Sun className="w-4 h-4 text-amber-500" />;
    if (index < 90) return <CloudRain className="w-4 h-4 text-blue-500" />;
    return <Target className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Best/Worst Months */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.best_month && (
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Best Performing Month</p>
                  <p className="text-xl font-bold text-green-700">{data.best_month.month_name}</p>
                  <p className="text-sm text-green-600">
                    Index: {data.best_month.seasonality_index} ({data.best_month.avg_leads} avg leads)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {data.worst_month && (
          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-xl">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Weakest Month</p>
                  <p className="text-xl font-bold text-red-700">{data.worst_month.month_name}</p>
                  <p className="text-sm text-red-600">
                    Index: {data.worst_month.seasonality_index} ({data.worst_month.avg_leads} avg leads)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Seasonality Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Monthly Seasonality Pattern
          </CardTitle>
          <CardDescription>Historical average performance by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seasonality Index Table */}
      <Card>
        <CardHeader>
          <CardTitle>Seasonality Index by Month</CardTitle>
          <CardDescription>100 = Average. Above 100 = Above average performance</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-center">Index</TableHead>
                <TableHead className="text-right">Avg Leads</TableHead>
                <TableHead className="text-right">Avg Won</TableHead>
                <TableHead className="text-right">Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.seasonality?.map((month) => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {getSeasonIcon(month.seasonality_index)}
                    {month.month_name}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={month.seasonality_index > 100 ? 'default' : month.seasonality_index < 90 ? 'destructive' : 'secondary'}>
                      {month.seasonality_index}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{month.avg_leads}</TableCell>
                  <TableCell className="text-right">{month.avg_won}</TableCell>
                  <TableCell className="text-right text-gray-500">
                    {month.min_leads} - {month.max_leads}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================
// FORECAST SCENARIOS COMPONENT
// ============================================
export const ForecastScenarios = ({ monthsAhead = 3 }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/forecast-enhanced/forecast-scenarios?months_ahead=${monthsAhead}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load forecast scenarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [monthsAhead]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading forecast scenarios...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const chartData = {
    labels: data.predictions?.map(p => p.period) || [],
    datasets: [
      {
        label: 'Pessimistic',
        data: data.predictions?.map(p => p.scenarios.pessimistic.leads) || [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderDash: [5, 5],
        fill: false
      },
      {
        label: 'Realistic',
        data: data.predictions?.map(p => p.scenarios.realistic.leads) || [],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        fill: true
      },
      {
        label: 'Optimistic',
        data: data.predictions?.map(p => p.scenarios.optimistic.leads) || [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderDash: [5, 5],
        fill: false
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Scenario Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Pessimistic</p>
                <p className="text-2xl font-bold text-red-700">{data.scenario_totals?.pessimistic?.total_leads}</p>
                <p className="text-sm text-red-600">{data.scenario_totals?.pessimistic?.total_won} won</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Realistic</p>
                <p className="text-2xl font-bold text-indigo-700">{data.scenario_totals?.realistic?.total_leads}</p>
                <p className="text-sm text-indigo-600">{data.scenario_totals?.realistic?.total_won} won</p>
              </div>
              <Target className="w-8 h-8 text-indigo-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Optimistic</p>
                <p className="text-2xl font-bold text-green-700">{data.scenario_totals?.optimistic?.total_leads}</p>
                <p className="text-sm text-green-600">{data.scenario_totals?.optimistic?.total_won} won</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenarios Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />
            Scenario Comparison
          </CardTitle>
          <CardDescription>Pessimistic (-15%), Realistic, Optimistic (+15%)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' }
                },
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: 'Leads' } }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Confidence Bands Table */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Intervals</CardTitle>
          <CardDescription>Forecast range with ±15% and ±25% bands</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-center">Point Est.</TableHead>
                <TableHead className="text-center">±15% Range</TableHead>
                <TableHead className="text-center">±25% Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.predictions?.map((pred) => (
                <TableRow key={pred.period}>
                  <TableCell className="font-medium">{pred.period}</TableCell>
                  <TableCell className="text-center font-bold">
                    {pred.confidence_bands.leads.point_estimate}
                  </TableCell>
                  <TableCell className="text-center text-gray-600">
                    {pred.confidence_bands.leads.low_15} - {pred.confidence_bands.leads.high_15}
                  </TableCell>
                  <TableCell className="text-center text-gray-500">
                    {pred.confidence_bands.leads.low_25} - {pred.confidence_bands.leads.high_25}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================
// CONVERSION TIME ANALYSIS COMPONENT  
// ============================================
export const ConversionTimeAnalysis = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/forecast-enhanced/conversion-time-analysis`, { withCredentials: true });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to load conversion time analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading conversion time analysis...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <Card className="bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-100 rounded-xl">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Lead-to-Win Time</p>
              <p className="text-3xl font-bold text-blue-700">{data.overall_stats?.avg} days</p>
              <p className="text-sm text-gray-600">
                Median: {data.overall_stats?.median} days | Range: {data.overall_stats?.min}-{data.overall_stats?.max} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Dealer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Conversion Time by Dealer
          </CardTitle>
          <CardDescription>Dealers sorted by fastest conversion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.by_dealer?.map((dealer, idx) => (
              <div key={dealer.dealer} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{dealer.dealer}</span>
                    <span className="text-sm text-gray-500">{dealer.avg} days avg</span>
                  </div>
                  <Progress value={Math.min(100, (dealer.avg / data.overall_stats?.avg) * 50)} className="h-2" />
                </div>
                <Badge variant={dealer.avg < data.overall_stats?.avg ? 'default' : 'secondary'}>
                  {dealer.count} deals
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By Segment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Conversion Time by Segment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Avg Days</TableHead>
                <TableHead className="text-right">Median</TableHead>
                <TableHead className="text-right">Sample Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.by_segment?.map((seg) => (
                <TableRow key={seg.segment}>
                  <TableCell className="font-medium">{seg.segment}</TableCell>
                  <TableCell className="text-right">{seg.avg}</TableCell>
                  <TableCell className="text-right">{seg.median}</TableCell>
                  <TableCell className="text-right">{seg.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================
// MAIN ENHANCED FORECAST TAB
// ============================================
export const EnhancedForecastTab = ({ monthsAhead = 3 }) => {
  const [activeSubTab, setActiveSubTab] = useState('dealer-kva');

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="dealer-kva" className="text-xs">
            <Layers className="w-3 h-3 mr-1" />
            Dealer-KVA
          </TabsTrigger>
          <TabsTrigger value="dealer-district" className="text-xs">
            <MapPin className="w-3 h-3 mr-1" />
            Dealer-District
          </TabsTrigger>
          <TabsTrigger value="seasonality" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            Seasonality
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            Scenarios
          </TabsTrigger>
          <TabsTrigger value="conversion" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Conversion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dealer-kva" className="mt-6">
          <DealerKvaForecast monthsAhead={monthsAhead} />
        </TabsContent>

        <TabsContent value="dealer-district" className="mt-6">
          <DealerDistrictForecast monthsAhead={monthsAhead} />
        </TabsContent>

        <TabsContent value="seasonality" className="mt-6">
          <SeasonalityAnalysis />
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <ForecastScenarios monthsAhead={monthsAhead} />
        </TabsContent>

        <TabsContent value="conversion" className="mt-6">
          <ConversionTimeAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedForecastTab;
