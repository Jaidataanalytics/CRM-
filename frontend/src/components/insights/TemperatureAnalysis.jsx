import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Flame } from 'lucide-react';

const API = '/api';

const TemperatureAnalysis = ({ buildQueryParams }) => {
  const [temperatureData, setTemperatureData] = useState(null);
  const [temperatureLoading, setTemperatureLoading] = useState(false);
  const [temperatureDimension, setTemperatureDimension] = useState('dealer');

  const loadTemperatureAnalysis = useCallback(async () => {
    setTemperatureLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(
        `${API}/insights/temperature-analysis?${queryParams}&dimension=${temperatureDimension}`,
        { withCredentials: true }
      );
      setTemperatureData(res.data);
    } catch (error) {
      console.error('Error loading temperature analysis:', error);
    } finally {
      setTemperatureLoading(false);
    }
  }, [buildQueryParams, temperatureDimension]);

  useEffect(() => {
    loadTemperatureAnalysis();
  }, [loadTemperatureAnalysis]);

  if (temperatureLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={temperatureDimension} onValueChange={setTemperatureDimension}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Dimension" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dealer">By Dealer</SelectItem>
            <SelectItem value="state">By State</SelectItem>
            <SelectItem value="district">By District</SelectItem>
            <SelectItem value="segment">By Segment</SelectItem>
            <SelectItem value="source">By Source</SelectItem>
            <SelectItem value="employee">By Employee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hot Leads</p>
                <p className="text-3xl font-bold text-red-600">{temperatureData?.summary?.hot || 0}</p>
              </div>
              <Flame className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {temperatureData?.summary?.hot_pct || 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warm Leads</p>
                <p className="text-3xl font-bold text-amber-600">{temperatureData?.summary?.warm || 0}</p>
              </div>
              <Flame className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {temperatureData?.summary?.warm_pct || 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cold Leads</p>
                <p className="text-3xl font-bold text-blue-600">{temperatureData?.summary?.cold || 0}</p>
              </div>
              <Flame className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {temperatureData?.summary?.cold_pct || 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Temperature Distribution by {temperatureDimension.charAt(0).toUpperCase() + temperatureDimension.slice(1)}
          </CardTitle>
          <CardDescription>
            Lead distribution across Hot, Warm, and Cold categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {temperatureData?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{temperatureDimension.charAt(0).toUpperCase() + temperatureDimension.slice(1)}</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center text-red-600">Hot</TableHead>
                    <TableHead className="text-center text-amber-600">Warm</TableHead>
                    <TableHead className="text-center text-blue-600">Cold</TableHead>
                    <TableHead className="text-center">Hot %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {temperatureData.data.slice(0, 20).map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">{item.total}</TableCell>
                      <TableCell className="text-center text-red-600 font-medium">{item.hot}</TableCell>
                      <TableCell className="text-center text-amber-600">{item.warm}</TableCell>
                      <TableCell className="text-center text-blue-600">{item.cold}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.hot_pct > 30 ? 'default' : 'secondary'}>
                          {item.hot_pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No temperature data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TemperatureAnalysis;
