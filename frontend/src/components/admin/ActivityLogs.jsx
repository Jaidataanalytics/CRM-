import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const API = '/api';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
};

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  const loadLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/activity-logs?page=${logsPage}&limit=20`, { withCredentials: true });
      setLogs(res.data.logs || []);
      setLogsTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [logsPage]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
        <CardDescription>Recent user activities</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div>
                    <p className="font-medium">{log.user_name}</p>
                    <p className="text-xs text-muted-foreground">{log.user_email}</p>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                <TableCell>
                  <span className="text-sm">{log.resource_type}</span>
                  {log.resource_id && (
                    <span className="text-xs text-muted-foreground block font-mono">{log.resource_id}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{formatDate(log.created_at)}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No activity logs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">Page {logsPage} of {logsTotalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))} disabled={logsPage === logsTotalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLogs;
