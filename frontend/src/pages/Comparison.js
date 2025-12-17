import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Plus, MapPin, Building, Users } from 'lucide-react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// India states TopoJSON URL (from a reliable CDN)
const INDIA_TOPO_JSON = "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-states.json";

// State district TopoJSON URLs (common states - fallback to state outline if not available)
const STATE_DISTRICTS = {
  "Bihar": "https://raw.githubusercontent.com/datameet/maps/master/districts/2011/bihar.json",
  "Jharkhand": "https://raw.githubusercontent.com/datameet/maps/master/districts/2011/jharkhand.json",
  "Chhattisgarh": "https://raw.githubusercontent.com/datameet/maps/master/districts/2011/chhattisgarh.json",
};

// Color scale based on performance
const getPerformanceColor = (value, max) => {
  if (!value || max === 0) return '#E5E7EB';
  const ratio = value / max;
  if (ratio >= 0.8) return '#059669'; // Green - excellent
  if (ratio >= 0.6) return '#10B981'; // Light green - good
  if (ratio >= 0.4) return '#FBBF24'; // Yellow - average
  if (ratio >= 0.2) return '#F97316'; // Orange - below average
  return '#EF4444'; // Red - poor
};

const Comparison = () => {
  const { buildQueryParams, filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [stateData, setStateData] = useState([]);
  const [dealerData, setDealerData] = useState([]);
  const [districtData, setDistrictData] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [selectedState, setSelectedState] = useState('');
  const [availableStates, setAvailableStates] = useState([]);
  const [tooltipContent, setTooltipContent] = useState('');
  const [newEntry, setNewEntry] = useState({ state: '', market_total: '', market_share: '' });
  const [viewMode, setViewMode] = useState('map'); // map or table

  useEffect(() => {
    loadInitialData();
  }, [buildQueryParams]);

  useEffect(() => {
    if (selectedState) {
      loadDistrictData(selectedState);
    }
  }, [selectedState]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [statesRes, dealersRes, filtersRes] = await Promise.all([
        axios.get(`${API}/insights/top-performers?by=state&metric=total&limit=50`, { withCredentials: true }),
        axios.get(`${API}/insights/top-performers?by=dealer&metric=total&limit=50`, { withCredentials: true }),
        axios.get(`${API}/filters/states`, { withCredentials: true })
      ]);
      setStateData(statesRes.data.performers || []);
      setDealerData(dealersRes.data.performers || []);
      setAvailableStates(filtersRes.data.states || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const loadDistrictData = async (state) => {
    try {
      // Get district-wise data from leads grouped by district
      const res = await axios.get(`${API}/comparison/district-performance?state=${state}`, { withCredentials: true });
      setDistrictData(res.data.districts || []);
    } catch (error) {
      console.error('Error loading district data:', error);
      // Fallback: try to get data from leads filter
      try {
        const leadsRes = await axios.get(`${API}/leads?state=${state}&limit=1000`, { withCredentials: true });
        // Group by district manually
        const districtMap = {};
        (leadsRes.data.leads || []).forEach(lead => {
          const district = lead.district || 'Unknown';
          if (!districtMap[district]) {
            districtMap[district] = { name: district, total_leads: 0, won_leads: 0, lost_leads: 0 };
          }
          districtMap[district].total_leads++;
          if (lead.enquiry_stage === 'Closed-Won') districtMap[district].won_leads++;
          if (lead.enquiry_stage === 'Closed-Lost') districtMap[district].lost_leads++;
        });
        setDistrictData(Object.values(districtMap));
      } catch (e) {
        setDistrictData([]);
      }
    }
  };

  const handleMarketDataChange = (state, field, value) => {
    setMarketData(prev => ({
      ...prev,
      [state]: { ...prev[state], [field]: value }
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

  const getComparison = (stateName) => {
    const internal = stateData.find(d => d.name === stateName);
    const market = marketData[stateName];
    
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

  const maxStateLeads = useMemo(() => Math.max(...stateData.map(s => s.total_leads), 1), [stateData]);
  const maxDistrictLeads = useMemo(() => Math.max(...districtData.map(d => d.total_leads), 1), [districtData]);

  const getStatePerformance = (stateName) => {
    return stateData.find(s => s.name?.toLowerCase() === stateName?.toLowerCase());
  };

  const getDistrictPerformance = (districtName) => {
    return districtData.find(d => d.name?.toLowerCase() === districtName?.toLowerCase());
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Market Comparison
          </h1>
          <p className="text-muted-foreground mt-1">Compare performance with interactive maps</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select State for Map" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All India</SelectItem>
              {availableStates.map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">Map View</TabsTrigger>
          <TabsTrigger value="state">State Comparison</TabsTrigger>
          <TabsTrigger value="dealer">Dealer Comparison</TabsTrigger>
          <TabsTrigger value="market">Market Data</TabsTrigger>
        </TabsList>

        {/* Map View */}
        <TabsContent value="map">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{selectedState ? `${selectedState} - District Performance` : 'India - State Performance'}</CardTitle>
                <CardDescription>
                  {selectedState ? 'District-wise lead distribution' : 'Click a state to see district-level data'}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[500px] relative">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: selectedState ? 2000 : 1000,
                    center: selectedState ? [85, 23] : [82, 22]
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <ZoomableGroup zoom={1}>
                    <Geographies geography={selectedState && STATE_DISTRICTS[selectedState] ? STATE_DISTRICTS[selectedState] : INDIA_TOPO_JSON}>
                      {({ geographies }) =>
                        geographies.map(geo => {
                          const name = geo.properties.NAME_1 || geo.properties.st_nm || geo.properties.name || geo.properties.NAME || geo.properties.district;
                          const performance = selectedState ? getDistrictPerformance(name) : getStatePerformance(name);
                          const maxVal = selectedState ? maxDistrictLeads : maxStateLeads;
                          
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={getPerformanceColor(performance?.total_leads, maxVal)}
                              stroke="#FFFFFF"
                              strokeWidth={0.5}
                              style={{
                                default: { outline: 'none' },
                                hover: { fill: '#6366F1', outline: 'none', cursor: 'pointer' },
                                pressed: { outline: 'none' }
                              }}
                              onMouseEnter={() => {
                                const perf = performance;
                                setTooltipContent(
                                  perf 
                                    ? `${name}: ${perf.total_leads} leads, ${perf.won_leads} won (${perf.conversion_rate || Math.round((perf.won_leads / (perf.won_leads + perf.lost_leads || 1)) * 100)}% conv)`
                                    : `${name}: No data`
                                );
                              }}
                              onMouseLeave={() => setTooltipContent('')}
                              onClick={() => {
                                if (!selectedState && availableStates.includes(name)) {
                                  setSelectedState(name);
                                }
                              }}
                              data-tooltip-id="map-tooltip"
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
                <Tooltip id="map-tooltip" content={tooltipContent} />
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 p-3 rounded-lg shadow-sm">
                  <p className="text-xs font-medium mb-2">Performance</p>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-[#059669] rounded" />
                    <span className="text-xs">Excellent</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-[#FBBF24] rounded" />
                    <span className="text-xs">Average</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-[#EF4444] rounded" />
                    <span className="text-xs">Poor</span>
                  </div>
                </div>

                {selectedState && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="absolute top-4 right-4"
                    onClick={() => setSelectedState('')}
                  >
                    Back to India
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Performance List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedState ? 'District Rankings' : 'State Rankings'}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {(selectedState ? districtData : stateData).slice(0, 15).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-white' : 
                          idx === 1 ? 'bg-gray-400 text-white' : 
                          idx === 2 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{item.total_leads}</p>
                        <p className="text-xs text-muted-foreground">{item.won_leads} won</p>
                      </div>
                    </div>
                  ))}
                  {(selectedState ? districtData : stateData).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* State Comparison Table */}
        <TabsContent value="state">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                State-wise Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Total Leads</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Lost</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Total KVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateData.map((state, idx) => (
                    <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedState(state.name)}>
                      <TableCell className="font-medium">{state.name}</TableCell>
                      <TableCell className="text-right">{state.total_leads}</TableCell>
                      <TableCell className="text-right text-green-600">{state.won_leads}</TableCell>
                      <TableCell className="text-right text-red-600">{state.lost_leads}</TableCell>
                      <TableCell className="text-right">{state.conversion_rate}%</TableCell>
                      <TableCell className="text-right">{state.total_kva?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dealer Comparison */}
        <TabsContent value="dealer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Dealer-wise Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Total Leads</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Lost</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Total KVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealerData.slice(0, 20).map((dealer, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{dealer.name}</TableCell>
                      <TableCell className="text-right">{dealer.total_leads}</TableCell>
                      <TableCell className="text-right text-green-600">{dealer.won_leads}</TableCell>
                      <TableCell className="text-right text-red-600">{dealer.lost_leads}</TableCell>
                      <TableCell className="text-right">{dealer.conversion_rate}%</TableCell>
                      <TableCell className="text-right">{dealer.total_kva?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market Data Entry */}
        <TabsContent value="market">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Add Market Data</CardTitle>
              <CardDescription>Enter external market data for comparison</CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle>Internal vs Market Comparison</CardTitle>
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
                  {stateData.map((state) => {
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
                                ? 'bg-green-100 text-green-800' 
                                : comparison.status === 'below'
                                ? 'bg-red-100 text-red-800'
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legend Card */}
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
