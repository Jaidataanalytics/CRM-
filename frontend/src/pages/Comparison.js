import { useState, useEffect } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Plus, Save } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Comparison = () => {
  const { buildQueryParams } = useFilters();
  const [loading, setLoading] = useState(true);
  const [internalData, setInternalData] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [newEntry, setNewEntry] = useState({ state: '', market_total: '', market_share: '' });

  useEffect(() => {
    loadData();
  }, [buildQueryParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/insights/top-performers?by=state&metric=total&limit=20`, {
        withCredentials: true
      });
      setInternalData(res.data.performers || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarketDataChange = (state, field, value) => {
    setMarketData(prev => ({
      ...prev,
      [state]: {
        ...prev[state],
        [field]: value
      }
    }));
  };

  const addMarketEntry = () => {
    if (!newEntry.state) {
      toast.error('Please enter a state name');
      return;
    }
    setMarketData(prev => ({
      ...prev,
      [newEntry.state]: {
        market_total: newEntry.market_total || 0,
        market_share: newEntry.market_share || 0
      }
    }));
    setNewEntry({ state: '', market_total: '', market_share: '' });
    toast.success('Market data added');
  };

  const getComparison = (state) => {
    const internal = internalData.find(d => d.name === state);
    const market = marketData[state];
    
    if (!internal || !market?.market_total) return null;
    
    const internalShare = internal.total_leads;
    const marketTotal = parseFloat(market.market_total) || 0;
    const calculatedShare = marketTotal > 0 ? ((internalShare / marketTotal) * 100).toFixed(1) : 0;
    const enteredShare = parseFloat(market.market_share) || 0;
    const difference = calculatedShare - enteredShare;
    
    return {
      calculatedShare,
      enteredShare,
      difference,
      status: difference > 0 ? 'above' : difference < 0 ? 'below' : 'equal'
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Market Comparison</h1>
        <p className="text-muted-foreground mt-1">Compare your performance against market data</p>
      </div>

      {/* Add Market Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Market Data</CardTitle>
          <CardDescription>Enter market data for comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                placeholder="State name"
                value={newEntry.state}
                onChange={(e) => setNewEntry(prev => ({ ...prev, state: e.target.value }))}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label>Market Total Leads</Label>
              <Input
                type="number"
                placeholder="Total market size"
                value={newEntry.market_total}
                onChange={(e) => setNewEntry(prev => ({ ...prev, market_total: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry Avg Share (%)</Label>
              <Input
                type="number"
                placeholder="Average %"
                value={newEntry.market_share}
                onChange={(e) => setNewEntry(prev => ({ ...prev, market_share: e.target.value }))}
                className="w-32"
              />
            </div>
            <Button onClick={addMarketEntry} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>State-wise Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Your Leads</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Conv. Rate</TableHead>
                <TableHead className="text-right">Market Total</TableHead>
                <TableHead className="text-right">Your Share</TableHead>
                <TableHead className="text-right">Industry Avg</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {internalData.map((state) => {
                const comparison = getComparison(state.name);
                const market = marketData[state.name];
                
                return (
                  <TableRow key={state.name}>
                    <TableCell className="font-medium">{state.name}</TableCell>
                    <TableCell className="text-right">{state.total_leads}</TableCell>
                    <TableCell className="text-right text-green-600">{state.won_leads}</TableCell>
                    <TableCell className="text-right">{state.conversion_rate}%</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        placeholder="-"
                        value={market?.market_total || ''}
                        onChange={(e) => handleMarketDataChange(state.name, 'market_total', e.target.value)}
                        className="w-24 h-8 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {comparison ? `${comparison.calculatedShare}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        placeholder="-"
                        value={market?.market_share || ''}
                        onChange={(e) => handleMarketDataChange(state.name, 'market_share', e.target.value)}
                        className="w-20 h-8 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {comparison ? (
                        <Badge className={`gap-1 ${
                          comparison.status === 'above' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : comparison.status === 'below'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {comparison.status === 'above' && <TrendingUp className="h-3 w-3" />}
                          {comparison.status === 'below' && <TrendingDown className="h-3 w-3" />}
                          {comparison.status === 'equal' && <Minus className="h-3 w-3" />}
                          {comparison.difference > 0 ? '+' : ''}{comparison.difference.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {internalData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 gap-1">
                <TrendingUp className="h-3 w-3" />
                Above Avg
              </Badge>
              <span className="text-muted-foreground">Performing above industry average</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-800 gap-1">
                <TrendingDown className="h-3 w-3" />
                Below Avg
              </Badge>
              <span className="text-muted-foreground">Performing below industry average</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Comparison;
