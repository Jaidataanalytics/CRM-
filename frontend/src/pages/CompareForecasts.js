import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Minus, Target, BarChart3, 
  Calendar, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Zap, MapPin, Building, Users
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompareForecasts = () => {
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [savedForecasts, setSavedForecasts] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedForecast, setSelectedForecast] = useState(null);
  const [expandedPrediction, setExpandedPrediction] = useState({});

  useEffect(() => {
    loadSavedForecasts();
  }, []);

  // When index changes, find and set the selected forecast
  useEffect(() => {
    if (selectedIndex !== null) {
      const forecast = savedForecasts.find(f => f.index === selectedIndex);
      setSelectedForecast(forecast);
    } else {
      setSelectedForecast(null);
    }
  }, [selectedIndex, savedForecasts]);

  const togglePrediction = (idx) => {
    setExpandedPrediction(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const loadSavedForecasts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/forecast/saved`, { withCredentials: true });
      setSavedForecasts(res.data.forecasts || []);
    } catch (error) {
      console.error('Error loading forecasts:', error);
      toast.error('Failed to load saved forecasts');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedIndex) {
      toast.error('Please select a forecast to compare');
      return;
    }
    
    setComparing(true);
    try {
      const res = await axios.get(`${API}/forecast/compare/${selectedIndex}`, { withCredentials: true });
      setComparisonData(res.data);
      toast.success('Comparison loaded successfully');
    } catch (error) {
      console.error('Error comparing:', error);
      toast.error(error.response?.data?.detail || 'Failed to compare forecast');
    } finally {
      setComparing(false);
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 80) return 'text-green-600 bg-green-100';
    if (accuracy >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getVarianceIcon = (variance) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Prepare chart data
  const getMonthlyChartData = () => {
    if (!comparisonData?.monthly_comparison) return [];
    return comparisonData.monthly_comparison.map(m => ({
      month: m.month.substring(0, 3),
      'Predicted Leads': m.predicted.leads,
      'Actual Leads': m.actual.leads,
      'Predicted Closures': m.predicted.closures,
      'Actual Closures': m.actual.closures,
      'Leads Accuracy': m.accuracy.leads,
      'Closures Accuracy': m.accuracy.closures
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="compare-forecasts-title">
            <Target className="h-8 w-8" />
            Compare Forecasts
          </h1>
          <p className="text-muted-foreground mt-1">Compare your saved projections against actual results</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSavedForecasts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Forecast Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select a Saved Projection
          </CardTitle>
          <CardDescription>
            Choose a previously saved forecast to compare against actual data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Select 
                value={selectedIndex?.toString() || ''} 
                onValueChange={(v) => setSelectedIndex(parseInt(v))}
              >
                <SelectTrigger data-testid="forecast-select">
                  <SelectValue placeholder="Select a saved forecast" />
                </SelectTrigger>
                <SelectContent>
                  {savedForecasts.length === 0 ? (
                    <SelectItem value="none" disabled>No saved forecasts found</SelectItem>
                  ) : (
                    savedForecasts.map((f) => (
                      <SelectItem key={f.index} value={f.index.toString()}>
                        #{f.index} - {formatDate(f.saved_at)} by {f.saved_by} ({f.horizon_months} months)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleCompare} 
              disabled={!selectedIndex || comparing}
              data-testid="compare-button"
            >
              {comparing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Compare
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparisonData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Accuracy */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                    <p className={`text-3xl font-bold ${comparisonData.totals.accuracy.overall >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                      {comparisonData.totals.accuracy.overall}%
                    </p>
                  </div>
                  {comparisonData.totals.accuracy.overall >= 70 ? (
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  ) : (
                    <AlertCircle className="h-10 w-10 text-orange-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Model: {comparisonData.forecast_info.model_info?.best_model || 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Leads Accuracy */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Leads Accuracy</p>
                    <p className="text-2xl font-bold">{comparisonData.totals.accuracy.leads}%</p>
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {getVarianceIcon(comparisonData.totals.variance.leads)}
                      <span>
                        {comparisonData.totals.variance.leads > 0 ? '+' : ''}
                        {comparisonData.totals.variance.leads.toLocaleString()} variance
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Pred: {comparisonData.totals.predicted.leads.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Act: {comparisonData.totals.actual.leads.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Closures Accuracy */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Closures Accuracy</p>
                    <p className="text-2xl font-bold">{comparisonData.totals.accuracy.closures}%</p>
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {getVarianceIcon(comparisonData.totals.variance.closures)}
                      <span>
                        {comparisonData.totals.variance.closures > 0 ? '+' : ''}
                        {comparisonData.totals.variance.closures.toLocaleString()} variance
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Pred: {comparisonData.totals.predicted.closures.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Act: {comparisonData.totals.actual.closures.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KVA Accuracy */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">KVA Accuracy</p>
                    <p className="text-2xl font-bold">{comparisonData.totals.accuracy.kva}%</p>
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {getVarianceIcon(comparisonData.totals.variance.kva)}
                      <span>
                        {comparisonData.totals.variance.kva > 0 ? '+' : ''}
                        {comparisonData.totals.variance.kva.toLocaleString()} variance
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Pred: {comparisonData.totals.predicted.kva.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Act: {comparisonData.totals.actual.kva.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts & Tables */}
          <Tabs defaultValue="monthly" className="space-y-4">
            <TabsList>
              <TabsTrigger value="monthly">
                <Calendar className="h-4 w-4 mr-2" />
                Monthly View
              </TabsTrigger>
              <TabsTrigger value="kva">
                <Zap className="h-4 w-4 mr-2" />
                KVA Breakdown
              </TabsTrigger>
              <TabsTrigger value="state">
                <MapPin className="h-4 w-4 mr-2" />
                State Breakdown
              </TabsTrigger>
              <TabsTrigger value="dealer">
                <Building className="h-4 w-4 mr-2" />
                Dealer Breakdown
              </TabsTrigger>
            </TabsList>

            {/* Monthly View */}
            <TabsContent value="monthly" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Predicted vs Actual</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={getMonthlyChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Predicted Leads" fill="#6366f1" />
                        <Bar dataKey="Actual Leads" fill="#22c55e" />
                        <Line type="monotone" dataKey="Leads Accuracy" stroke="#f59e0b" yAxisId="right" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Closures Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Closures Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getMonthlyChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Predicted Closures" fill="#8b5cf6" />
                        <Bar dataKey="Actual Closures" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Comparison Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Pred. Leads</TableHead>
                        <TableHead className="text-right">Act. Leads</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-right">Accuracy</TableHead>
                        <TableHead className="text-right">Pred. Closures</TableHead>
                        <TableHead className="text-right">Act. Closures</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.monthly_comparison.map((m, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="text-right">{m.predicted.leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{m.actual.leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <span className={m.variance.leads >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {m.variance.leads > 0 ? '+' : ''}{m.variance.leads.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(m.accuracy.leads)}>
                              {m.accuracy.leads}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{m.predicted.closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{m.actual.closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {m.has_actual_data ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Data Available
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-500">
                                No Data Yet
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* KVA Breakdown */}
            <TabsContent value="kva">
              <Card>
                <CardHeader>
                  <CardTitle>KVA Breakdown Comparison</CardTitle>
                  <CardDescription>Predicted vs Actual performance by KVA category</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>KVA</TableHead>
                        <TableHead className="text-right">Pred. Leads</TableHead>
                        <TableHead className="text-right">Act. Leads</TableHead>
                        <TableHead className="text-right">Leads Acc.</TableHead>
                        <TableHead className="text-right">Pred. Closures</TableHead>
                        <TableHead className="text-right">Act. Closures</TableHead>
                        <TableHead className="text-right">Closures Acc.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.breakdown_comparison.kva.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.name} KVA</TableCell>
                          <TableCell className="text-right">{item.predicted_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.actual_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(item.accuracy_leads)}>
                              {item.accuracy_leads}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.predicted_closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.actual_closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(item.accuracy_closures)}>
                              {item.accuracy_closures}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* State Breakdown */}
            <TabsContent value="state">
              <Card>
                <CardHeader>
                  <CardTitle>State Breakdown Comparison</CardTitle>
                  <CardDescription>Predicted vs Actual performance by State</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Pred. Leads</TableHead>
                        <TableHead className="text-right">Act. Leads</TableHead>
                        <TableHead className="text-right">Leads Acc.</TableHead>
                        <TableHead className="text-right">Pred. Closures</TableHead>
                        <TableHead className="text-right">Act. Closures</TableHead>
                        <TableHead className="text-right">Closures Acc.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.breakdown_comparison.state.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.predicted_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.actual_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(item.accuracy_leads)}>
                              {item.accuracy_leads}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.predicted_closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.actual_closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(item.accuracy_closures)}>
                              {item.accuracy_closures}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Dealer Breakdown */}
            <TabsContent value="dealer">
              <Card>
                <CardHeader>
                  <CardTitle>Dealer Breakdown Comparison</CardTitle>
                  <CardDescription>Predicted vs Actual performance by Dealer</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dealer</TableHead>
                        <TableHead className="text-right">Pred. Leads</TableHead>
                        <TableHead className="text-right">Act. Leads</TableHead>
                        <TableHead className="text-right">Leads Acc.</TableHead>
                        <TableHead className="text-right">Pred. Closures</TableHead>
                        <TableHead className="text-right">Act. Closures</TableHead>
                        <TableHead className="text-right">Closures Acc.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.breakdown_comparison.dealer.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium truncate max-w-[200px]">{item.name}</TableCell>
                          <TableCell className="text-right">{item.predicted_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.actual_leads.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(item.accuracy_leads)}>
                              {item.accuracy_leads}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.predicted_closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.actual_closures.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={getAccuracyColor(item.accuracy_closures)}>
                              {item.accuracy_closures}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Instructions when no comparison loaded */}
      {!comparisonData && (
        <Card>
          <CardContent className="pt-6">
            <h4 className="font-medium mb-2">How to use:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>First, generate and save a forecast from the Forecast page</li>
              <li>Select a saved forecast from the dropdown above</li>
              <li>Click &quot;Compare&quot; to see how predictions matched actual results</li>
              <li>Review monthly, KVA, State, and Dealer breakdowns</li>
              <li>Use accuracy metrics to evaluate forecast quality</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CompareForecasts;
