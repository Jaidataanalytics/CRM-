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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Minus, Target, BarChart3, 
  Calendar, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  FileText, GitCompare
} from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';

const API = '/api';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

export const CompareTab = () => {
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [savedForecasts, setSavedForecasts] = useState([]);
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedForecast, setSelectedForecast] = useState(null);

  useEffect(() => {
    loadSavedForecasts();
  }, []);

  useEffect(() => {
    if (selectedProjectionId) {
      const forecast = savedForecasts.find(f => f.projection_id === selectedProjectionId || f.index?.toString() === selectedProjectionId);
      setSelectedForecast(forecast);
    } else {
      setSelectedForecast(null);
    }
  }, [selectedProjectionId, savedForecasts]);

  const loadSavedForecasts = async () => {
    setLoading(true);
    try {
      // Try enhanced API first, fall back to legacy
      let forecasts = [];
      try {
        const enhancedRes = await axios.get(`${API}/forecast-enhanced/projections`, { withCredentials: true });
        if (enhancedRes.data.projections?.length > 0) {
          forecasts = enhancedRes.data.projections.map((p, idx) => ({
            ...p,
            index: idx,
            label: `${p.projection_id?.slice(-6) || idx} - ${new Date(p.saved_at).toLocaleDateString()}`
          }));
        }
      } catch (e) {
        console.log('Enhanced API not available, using legacy');
      }
      
      // Also try legacy API and merge
      try {
        const legacyRes = await axios.get(`${API}/forecast/saved`, { withCredentials: true });
        if (legacyRes.data.forecasts?.length > 0) {
          const legacyForecasts = legacyRes.data.forecasts.map((f, idx) => ({
            ...f,
            label: `Legacy #${f.index || idx} - ${new Date(f.saved_at).toLocaleDateString()}`
          }));
          forecasts = [...forecasts, ...legacyForecasts];
        }
      } catch (e) {
        console.log('Legacy API not available');
      }
      
      setSavedForecasts(forecasts);
    } catch (error) {
      console.error('Error loading forecasts:', error);
      toast.error('Failed to load saved forecasts');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedProjectionId) {
      toast.error('Please select a forecast to compare');
      return;
    }
    
    setComparing(true);
    try {
      // Try enhanced comparison first
      const forecast = savedForecasts.find(f => f.projection_id === selectedProjectionId || f.index?.toString() === selectedProjectionId);
      
      if (forecast?.projection_id) {
        // Enhanced projection - use enhanced compare endpoint
        const res = await axios.get(`${API}/forecast-enhanced/compare/${forecast.projection_id}`, { withCredentials: true });
        setComparisonData(res.data);
      } else {
        // Legacy forecast
        const res = await axios.get(`${API}/forecast/compare/${selectedProjectionId}`, { withCredentials: true });
        setComparisonData(res.data);
      }
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
    if (!comparisonData?.monthly_comparison) return null;
    
    const data = comparisonData.monthly_comparison;
    return {
      labels: data.map(m => m.month?.substring(0, 7) || ''),
      datasets: [
        {
          label: 'Predicted Leads',
          data: data.map(m => m.predicted?.leads || 0),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderRadius: 4
        },
        {
          label: 'Actual Leads',
          data: data.map(m => m.actual?.leads || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderRadius: 4
        }
      ]
    };
  };

  const getAccuracyChartData = () => {
    if (!comparisonData?.monthly_comparison) return null;
    
    const data = comparisonData.monthly_comparison;
    return {
      labels: data.map(m => m.month?.substring(0, 7) || ''),
      datasets: [
        {
          label: 'Leads Accuracy %',
          data: data.map(m => m.accuracy?.leads || 0),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Closures Accuracy %',
          data: data.map(m => m.accuracy?.closures || 0),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading saved forecasts...</p>
        </CardContent>
      </Card>
    );
  }

  const monthlyChartData = getMonthlyChartData();
  const accuracyChartData = getAccuracyChartData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-indigo-600" />
            Compare Forecasts vs Actual
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a saved projection to see how accurate it was
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSavedForecasts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Forecast Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select a Saved Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Select 
                value={selectedProjectionId || ''} 
                onValueChange={(v) => setSelectedProjectionId(v)}
              >
                <SelectTrigger data-testid="compare-forecast-select">
                  <SelectValue placeholder="Select a saved forecast" />
                </SelectTrigger>
                <SelectContent>
                  {savedForecasts.length === 0 ? (
                    <SelectItem value="none" disabled>No saved forecasts found</SelectItem>
                  ) : (
                    savedForecasts.map((f, idx) => (
                      <SelectItem key={f.projection_id || f.index || idx} value={f.projection_id || f.index?.toString() || idx.toString()}>
                        {f.projection_id ? (
                          <>
                            #{f.projection_id.slice(-6)} - {formatDate(f.saved_at)} 
                            {f.saved_by?.name ? ` by ${f.saved_by.name}` : ''} 
                            ({f.parameters?.months_ahead || f.horizon_months || 3} months)
                            {f.model_selection ? ' [AI]' : ''}
                          </>
                        ) : (
                          <>
                            #{f.index} - {formatDate(f.saved_at)} by {f.saved_by} ({f.horizon_months} months)
                          </>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleCompare} 
              disabled={!selectedProjectionId || comparing}
              data-testid="run-compare-button"
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

      {/* No Forecasts Message */}
      {savedForecasts.length === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="font-medium text-amber-800">No Saved Forecasts</h3>
            <p className="text-sm text-amber-600 mt-2">
              Generate a forecast first, then save it to compare against actual results later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisonData && (
        <>
          {/* Overall Accuracy Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Leads Accuracy</p>
                    <p className="text-3xl font-bold text-indigo-700">
                      {comparisonData.overall_accuracy?.leads?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${getAccuracyColor(comparisonData.overall_accuracy?.leads || 0)}`}>
                    {comparisonData.overall_accuracy?.leads >= 70 ? 
                      <CheckCircle2 className="h-6 w-6" /> : 
                      <AlertCircle className="h-6 w-6" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Closures Accuracy</p>
                    <p className="text-3xl font-bold text-green-700">
                      {comparisonData.overall_accuracy?.closures?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${getAccuracyColor(comparisonData.overall_accuracy?.closures || 0)}`}>
                    {comparisonData.overall_accuracy?.closures >= 70 ? 
                      <CheckCircle2 className="h-6 w-6" /> : 
                      <AlertCircle className="h-6 w-6" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">KVA Accuracy</p>
                    <p className="text-3xl font-bold text-purple-700">
                      {comparisonData.overall_accuracy?.kva?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${getAccuracyColor(comparisonData.overall_accuracy?.kva || 0)}`}>
                    {comparisonData.overall_accuracy?.kva >= 70 ? 
                      <CheckCircle2 className="h-6 w-6" /> : 
                      <AlertCircle className="h-6 w-6" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Predicted vs Actual Chart */}
            {monthlyChartData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    Predicted vs Actual Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Bar
                      data={monthlyChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } },
                        scales: { y: { beginAtZero: true } }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Accuracy Trend Chart */}
            {accuracyChartData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Accuracy Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Line
                      data={accuracyChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } },
                        scales: { 
                          y: { 
                            beginAtZero: true,
                            max: 100,
                            title: { display: true, text: 'Accuracy %' }
                          } 
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Monthly Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Breakdown
              </CardTitle>
              <CardDescription>
                Detailed comparison for each month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-center">Predicted Leads</TableHead>
                      <TableHead className="text-center">Actual Leads</TableHead>
                      <TableHead className="text-center">Variance</TableHead>
                      <TableHead className="text-center">Accuracy</TableHead>
                      <TableHead className="text-center">Predicted Closures</TableHead>
                      <TableHead className="text-center">Actual Closures</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.monthly_comparison?.map((month, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{month.month}</TableCell>
                        <TableCell className="text-center">{month.predicted?.leads || 0}</TableCell>
                        <TableCell className="text-center">{month.actual?.leads || 0}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getVarianceIcon(month.variance?.leads || 0)}
                            <span className={month.variance?.leads > 0 ? 'text-green-600' : month.variance?.leads < 0 ? 'text-red-600' : ''}>
                              {month.variance?.leads > 0 ? '+' : ''}{month.variance?.leads || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getAccuracyColor(month.accuracy?.leads || 0)}>
                            {month.accuracy?.leads?.toFixed(0) || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{month.predicted?.closures || 0}</TableCell>
                        <TableCell className="text-center">{month.actual?.closures || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          {comparisonData.insights && comparisonData.insights.length > 0 && (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Insights & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {comparisonData.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-blue-800">{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CompareTab;
