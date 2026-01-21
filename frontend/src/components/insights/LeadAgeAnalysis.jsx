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
import { Clock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LeadAgeAnalysis = ({ buildQueryParams }) => {
  const [leadAgeData, setLeadAgeData] = useState(null);
  const [leadAgeLoading, setLeadAgeLoading] = useState(false);
  const [leadAgeDimension, setLeadAgeDimension] = useState('dealer');

  const loadLeadAgeAnalysis = useCallback(async () => {
    setLeadAgeLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(
        `${API}/insights/lead-age-analysis?${queryParams}&dimension=${leadAgeDimension}`,
        { withCredentials: true }
      );
      setLeadAgeData(res.data);
    } catch (error) {
      console.error('Error loading lead age analysis:', error);
    } finally {
      setLeadAgeLoading(false);
    }
  }, [buildQueryParams, leadAgeDimension]);

  useEffect(() => {
    loadLeadAgeAnalysis();
  }, [loadLeadAgeAnalysis]);

  if (leadAgeLoading) {
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
        <Select value={leadAgeDimension} onValueChange={setLeadAgeDimension}>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Avg Age</p>
                <p className="text-3xl font-bold text-purple-600">{leadAgeData?.summary?.avg_age || 0}d</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">0-30 Days</p>
            <p className="text-2xl font-bold text-green-600">{leadAgeData?.summary?.age_0_30 || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">31-60 Days</p>
            <p className="text-2xl font-bold text-yellow-600">{leadAgeData?.summary?.age_31_60 || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">90+ Days</p>
            <p className="text-2xl font-bold text-red-600">{leadAgeData?.summary?.age_90_plus || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Lead Age by {leadAgeDimension.charAt(0).toUpperCase() + leadAgeDimension.slice(1)}
          </CardTitle>
          <CardDescription>
            Average lead age and distribution across age buckets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leadAgeData?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{leadAgeDimension.charAt(0).toUpperCase() + leadAgeDimension.slice(1)}</TableHead>
                    <TableHead className="text-center">Open Leads</TableHead>
                    <TableHead className="text-center text-purple-600">Avg Age</TableHead>
                    <TableHead className="text-center">Min Age</TableHead>
                    <TableHead className="text-center">Max Age</TableHead>
                    <TableHead className="text-center text-green-600">0-30d</TableHead>
                    <TableHead className="text-center text-yellow-600">31-60d</TableHead>
                    <TableHead className="text-center text-orange-600">61-90d</TableHead>
                    <TableHead className="text-center text-red-600">90+d</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadAgeData.data.slice(0, 30).map((item, idx) => (
                    <TableRow 
                      key={idx} 
                      className={item.avg_lead_age > 90 ? 'bg-red-50' : item.avg_lead_age > 60 ? 'bg-orange-50' : ''}
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">{item.total_open_leads}</TableCell>
                      <TableCell className="text-center font-bold text-purple-600">{item.avg_lead_age} days</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.min_lead_age}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.max_lead_age}</TableCell>
                      <TableCell className="text-center text-green-600">{item.age_0_30}</TableCell>
                      <TableCell className="text-center text-yellow-600">{item.age_31_60}</TableCell>
                      <TableCell className="text-center text-orange-600">{item.age_61_90}</TableCell>
                      <TableCell className="text-center text-red-600 font-medium">{item.age_90_plus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No lead age data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadAgeAnalysis;
