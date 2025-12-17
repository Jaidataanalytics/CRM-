import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import { 
  Sparkles, TrendingUp, AlertCircle, Lightbulb, Calendar, 
  ChevronDown, ChevronRight, MapPin, Building, Users, PieChart,
  BarChart3
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
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
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
);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

const BreakdownSection = ({ title, icon: Icon, data, expanded, onToggle }) => {
  if (!data || data.length === 0) return null;
  
  const chartData = {
    labels: data.slice(0, 10).map(d => d.name?.substring(0, 15) || 'Unknown'),
    datasets: [{
      data: data.slice(0, 10).map(d => d.predicted || 0),
      backgroundColor: COLORS,
      borderWidth: 0
    }]
  };

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <span className="font-medium">{title}</span>
            <Badge variant="secondary" className="ml-2">{data.length} items</Badge>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{title.replace('By ', '')}</TableHead>
                  <TableHead className="text-right">Predicted</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="w-24">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.name || 'Unknown'}</TableCell>
                    <TableCell className="text-right">{item.predicted?.toLocaleString() || 0}</TableCell>
                    <TableCell className="text-right">{item.percentage?.toFixed(1) || 0}%</TableCell>
                    <TableCell>
                      <Progress value={item.percentage || 0} className="h-2" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Chart */}
          <div className="h-64 flex items-center justify-center">
            <Pie 
              data={chartData}
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const Forecast = () => {
  const [horizon, setHorizon] = useState('3');
  const [state, setState] = useState('');
  const [dealer, setDealer] = useState('');
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    state: true,
    dealer: false,
    segment: false,
    employee: false
  });

  const generateForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/forecast`, {
        horizon: parseInt(horizon),
        state: state || undefined,
        dealer: dealer || undefined
      }, { withCredentials: true });
      
      if (res.data.success) {
        setForecast(res.data);
        if (res.data.forecast?.predictions?.length > 0) {
          setExpandedMonth(0);
        }
        toast.success('Forecast generated successfully');
      } else {
        setError(res.data.message || 'Forecast generation failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate forecast');
      toast.error('Forecast generation failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Chart data for predictions - Bar chart style (better visibility)
  const predictionChartData = forecast?.forecast?.predictions ? {
    labels: forecast.forecast.predictions.map(p => p.month),
    datasets: [
      {
        label: 'Predicted Enquiries',
        data: forecast.forecast.predictions.map(p => p.predicted_enquiries),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'Predicted Closures',
        data: forecast.forecast.predictions.map(p => p.predicted_closures),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  } : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI-Powered Forecast
        </h1>
        <p className="text-muted-foreground mt-1">Generate intelligent predictions with detailed breakdown</p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Forecast Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Forecast Horizon</Label>
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>State (Optional)</Label>
              <Input
                placeholder="Filter by state..."
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label>Dealer (Optional)</Label>
              <Input
                placeholder="Filter by dealer..."
                value={dealer}
                onChange={(e) => setDealer(e.target.value)}
                className="w-48"
              />
            </div>
            <Button onClick={generateForecast} disabled={loading} className="gap-2">
              {loading ? (
                <>Generating...</>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Forecast
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">AI is analyzing data and generating detailed forecast...</p>
              <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Results */}
      {forecast?.success && forecast.forecast && (
        <div className="space-y-6">
          {/* Summary */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Forecast Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{forecast.forecast.summary}</p>
              
              {forecast.forecast.factors && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Key Factors:</h4>
                  <div className="flex flex-wrap gap-2">
                    {forecast.forecast.factors.map((factor, idx) => (
                      <Badge key={idx} variant="secondary">{factor}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prediction Chart */}
          {predictionChartData && (
            <Card>
              <CardHeader>
                <CardTitle>Prediction Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <Bar 
                  data={predictionChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { 
                        position: 'top',
                        labels: { font: { size: 12 } }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${context.raw.toLocaleString()}`
                        }
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => value.toLocaleString()
                        }
                      },
                      x: {
                        grid: { display: false }
                      }
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Detailed Monthly Predictions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detailed Monthly Breakdown
              </CardTitle>
              <CardDescription>Click on a month to see the complete breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {forecast.forecast.predictions?.map((prediction, idx) => (
                <Collapsible 
                  key={idx} 
                  open={expandedMonth === idx}
                  onOpenChange={() => setExpandedMonth(expandedMonth === idx ? null : idx)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-bold">{prediction.month}</div>
                        <Badge variant={
                          prediction.confidence === 'high' ? 'default' :
                          prediction.confidence === 'medium' ? 'secondary' : 'outline'
                        }>
                          {prediction.confidence} confidence
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{prediction.predicted_enquiries?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Predicted Leads</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{prediction.predicted_closures?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Predicted Closures</p>
                        </div>
                        {expandedMonth === idx ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    {prediction.breakdown && (
                      <div className="mt-4 border rounded-lg divide-y">
                        <BreakdownSection
                          title="By State"
                          icon={MapPin}
                          data={prediction.breakdown.by_state}
                          expanded={expandedSections.state}
                          onToggle={() => toggleSection('state')}
                        />
                        <BreakdownSection
                          title="By Dealer"
                          icon={Building}
                          data={prediction.breakdown.by_dealer}
                          expanded={expandedSections.dealer}
                          onToggle={() => toggleSection('dealer')}
                        />
                        <BreakdownSection
                          title="By Segment"
                          icon={PieChart}
                          data={prediction.breakdown.by_segment}
                          expanded={expandedSections.segment}
                          onToggle={() => toggleSection('segment')}
                        />
                        <BreakdownSection
                          title="By Employee"
                          icon={Users}
                          data={prediction.breakdown.by_employee}
                          expanded={expandedSections.employee}
                          onToggle={() => toggleSection('employee')}
                        />
                      </div>
                    )}
                    
                    {!prediction.breakdown && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                        Detailed breakdown not available for this prediction
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {forecast.forecast.recommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {forecast.forecast.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Forecast;
