import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Building, MapPin, Globe, ChevronRight } from 'lucide-react';

const API = '/api';

const TopPerformers = ({ buildQueryParams }) => {
  const navigate = useNavigate();
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [performerType, setPerformerType] = useState('employee');
  const [metric, setMetric] = useState('won');

  const loadPerformers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(
        `${API}/insights/top-performers?by=${performerType}&metric=${metric}&${queryParams}`,
        { withCredentials: true }
      );
      setPerformers(res.data.performers || []);
    } catch (error) {
      console.error('Error loading performers:', error);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, performerType, metric]);

  useEffect(() => {
    loadPerformers();
  }, [loadPerformers]);

  const getPerformerIcon = () => {
    switch (performerType) {
      case 'employee': return Users;
      case 'dealer': return Building;
      case 'state': return MapPin;
      case 'district': return MapPin;
      case 'source': return Globe;
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
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <Select value={performerType} onValueChange={setPerformerType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="View by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">By Employee</SelectItem>
            <SelectItem value="dealer">By Dealer</SelectItem>
            <SelectItem value="state">By State</SelectItem>
            <SelectItem value="district">By District</SelectItem>
            <SelectItem value="source">By Source</SelectItem>
          </SelectContent>
        </Select>

        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="won">Won Leads</SelectItem>
            <SelectItem value="total">Total Leads</SelectItem>
            <SelectItem value="conversion_rate">Conversion Rate</SelectItem>
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
                           metric === 'won' ? p.won_leads : p.total_leads;
              const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
              
              return (
                <div 
                  key={p.name} 
                  className="space-y-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                  onClick={() => {
                    if (['employee', 'dealer', 'state'].includes(performerType)) {
                      navigate(`/profile/${performerType}/${encodeURIComponent(p.name)}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${idx < 3 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                        #{idx + 1}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{p.name}</span>
                      {['employee', 'dealer', 'state'].includes(performerType) && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={idx < 3 ? 'default' : 'secondary'}>
                        {metric === 'conversion_rate' ? `${value}%` : value.toLocaleString()}
                      </Badge>
                      {metric !== 'conversion_rate' && (
                        <span className="text-sm text-muted-foreground">
                          ({p.conversion_rate}% conv)
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
            {performers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No performers data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TopPerformers;
