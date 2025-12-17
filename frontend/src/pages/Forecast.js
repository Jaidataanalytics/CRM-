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
import { toast } from 'sonner';
import { Sparkles, TrendingUp, AlertCircle, Lightbulb, Calendar } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Forecast = () => {
  const [horizon, setHorizon] = useState('3');
  const [state, setState] = useState('');
  const [dealer, setDealer] = useState('');
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);

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
      } else {
        setError(res.data.message);
        setForecast(null);
      }
    } catch (err) {
      console.error('Forecast error:', err);
      setError(err.response?.data?.detail || 'Failed to generate forecast');
      toast.error('Failed to generate forecast');
    } finally {
      setLoading(false);
    }
  };

  const chartData = forecast ? {
    labels: [
      ...(forecast.historical_data?.map(d => d._id) || []),
      ...(forecast.forecast?.predictions?.map(p => p.month) || [])
    ],
    datasets: [
      {
        label: 'Historical Enquiries',
        data: [
          ...(forecast.historical_data?.map(d => d.total_enquiries) || []),
          ...Array(forecast.forecast?.predictions?.length || 0).fill(null)
        ],
        borderColor: 'hsl(243, 75%, 59%)',
        backgroundColor: 'hsl(243, 75%, 59%, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Predicted Enquiries',
        data: [
          ...Array(forecast.historical_data?.length || 0).fill(null),
          ...(forecast.forecast?.predictions?.map(p => p.predicted_enquiries) || [])
        ],
        borderColor: 'hsl(142, 71%, 45%)',
        backgroundColor: 'hsl(142, 71%, 45%, 0.1)',
        borderDash: [5, 5],
        tension: 0.4,
        fill: true
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12 }
    },
    scales: {
      y: { beginAtZero: true, grid: { display: false } },
      x: { grid: { display: false } }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI Forecast
        </h1>
        <p className="text-muted-foreground mt-1">AI-powered predictions using GPT-4o</p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forecast Configuration</CardTitle>
          <CardDescription>Configure parameters for your forecast</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Forecast Horizon</Label>
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger>
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
                placeholder="Filter by state"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dealer (Optional)</Label>
              <Input
                placeholder="Filter by dealer"
                value={dealer}
                onChange={(e) => setDealer(e.target.value)}
              />
            </div>
            <Button onClick={generateForecast} disabled={loading} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {loading ? 'Generating...' : 'Generate Forecast'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              <p className="text-muted-foreground">Analyzing historical data and generating predictions...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {forecast && forecast.success && (
        <div className="space-y-6">
          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Forecast Visualization</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              {chartData && <Line data={chartData} options={chartOptions} />}
            </CardContent>
          </Card>

          {/* Predictions Table */}
          {forecast.forecast?.predictions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {forecast.forecast.predictions.map((p, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{p.month}</span>
                          <Badge variant={p.confidence === 'high' ? 'default' : p.confidence === 'medium' ? 'secondary' : 'outline'}>
                            {p.confidence}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Enquiries</p>
                            <p className="font-bold text-lg">{p.predicted_enquiries}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Closures</p>
                            <p className="font-bold text-lg">{p.predicted_closures}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {forecast.forecast?.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{forecast.forecast.summary}</p>
                  {forecast.forecast.factors && (
                    <div className="mt-4">
                      <p className="font-medium mb-2">Key Factors:</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {forecast.forecast.factors.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {forecast.forecast?.recommendations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {forecast.forecast.recommendations.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span className="text-sm text-muted-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !forecast && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-lg font-medium mb-2">Ready to Generate Forecast</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Configure your parameters above and click "Generate Forecast" to get AI-powered predictions based on your historical lead data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Forecast;
