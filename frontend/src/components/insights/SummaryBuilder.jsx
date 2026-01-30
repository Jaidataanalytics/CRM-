import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, TrendingUp, TrendingDown, Minus, LayoutGrid } from 'lucide-react';

const API = '/api';

const SummaryBuilder = ({ buildQueryParams }) => {
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMetric, setSummaryMetric] = useState('total_leads');
  const [summaryTimeFrame, setSummaryTimeFrame] = useState('monthly');
  const [summaryDimension, setSummaryDimension] = useState('dealer');
  const [compareHistorical, setCompareHistorical] = useState(false);

  const loadSummaryBuilder = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(
        `${API}/insights/summary-builder?${queryParams}&metric=${summaryMetric}&time_frame=${summaryTimeFrame}&dimension=${summaryDimension}&compare_historical=${compareHistorical}`,
        { withCredentials: true }
      );
      setSummaryData(res.data);
    } catch (error) {
      console.error('Error loading summary builder:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [buildQueryParams, summaryMetric, summaryTimeFrame, summaryDimension, compareHistorical]);

  useEffect(() => {
    loadSummaryBuilder();
  }, [loadSummaryBuilder]);

  const exportSummaryToExcel = () => {
    if (!summaryData?.pivot_table) return;
    
    const dimension = summaryData.meta.dimension;
    let exportData = [];
    
    if (compareHistorical && summaryData.historical_comparison) {
      const { columns, rows, column_totals, grand_total } = summaryData.historical_comparison;
      
      rows.forEach(row => {
        let dataRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: row.dimension };
        columns.forEach(col => {
          const periodData = row.periods[col.current] || { current: 0, historical: 0, yoy_change: 0 };
          dataRow[`${col.current} (Current)`] = periodData.current;
          dataRow[`${col.historical || 'N/A'} (Prev)`] = periodData.historical;
          dataRow[`${col.current} YoY %`] = periodData.yoy_change;
        });
        dataRow['Total (Current)'] = row.total;
        dataRow['Total (Prev)'] = row.hist_total;
        dataRow['Total YoY %'] = row.yoy_change;
        exportData.push(dataRow);
      });
      
      let totalRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: 'Total' };
      columns.forEach(col => {
        const totals = column_totals[col.current] || { current: 0, historical: 0, yoy_change: 0 };
        totalRow[`${col.current} (Current)`] = totals.current;
        totalRow[`${col.historical || 'N/A'} (Prev)`] = totals.historical;
        totalRow[`${col.current} YoY %`] = totals.yoy_change;
      });
      totalRow['Total (Current)'] = grand_total.current;
      totalRow['Total (Prev)'] = grand_total.historical;
      totalRow['Total YoY %'] = grand_total.yoy_change;
      exportData.push(totalRow);
    } else {
      const { columns, rows, column_totals, grand_total } = summaryData.pivot_table;
      
      rows.forEach(row => {
        let dataRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: row.dimension };
        columns.forEach(col => {
          dataRow[col] = row.periods[col] || 0;
        });
        dataRow['Total'] = row.total;
        exportData.push(dataRow);
      });
      
      let totalRow = { [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: 'Total' };
      columns.forEach(col => {
        totalRow[col] = column_totals[col] || 0;
      });
      totalRow['Total'] = grand_total;
      exportData.push(totalRow);
    }
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    
    const filename = compareHistorical 
      ? `summary_${summaryDimension}_${summaryMetric}_${summaryTimeFrame}_yoy.xlsx`
      : `summary_${summaryDimension}_${summaryMetric}_${summaryTimeFrame}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const getYoYIcon = (change) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-500" />;
  };

  const getYoYClass = (change) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select value={summaryMetric} onValueChange={setSummaryMetric}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_leads">Total Leads</SelectItem>
              <SelectItem value="won_leads">Won Leads</SelectItem>
              <SelectItem value="lost_leads">Lost Leads</SelectItem>
              <SelectItem value="open_leads">Open Leads</SelectItem>
              <SelectItem value="conversion_rate">Conversion Rate</SelectItem>
            </SelectContent>
          </Select>

          <Select value={summaryTimeFrame} onValueChange={setSummaryTimeFrame}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Time Frame" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={summaryDimension} onValueChange={setSummaryDimension}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Dimension" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dealer">Dealer</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="district">District</SelectItem>
              <SelectItem value="segment">Segment</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="kva">KVA</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <Switch 
              id="compare-historical" 
              checked={compareHistorical}
              onCheckedChange={setCompareHistorical}
            />
            <Label htmlFor="compare-historical" className="text-sm">Compare YoY</Label>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportSummaryToExcel}
          disabled={!summaryData?.pivot_table?.rows?.length}
          className="mt-5"
          data-testid="export-summary-excel"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {summaryLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : summaryData?.pivot_table ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LayoutGrid className="h-5 w-5" />
              {summaryData.meta.dimension.charAt(0).toUpperCase() + summaryData.meta.dimension.slice(1)} by {summaryTimeFrame.charAt(0).toUpperCase() + summaryTimeFrame.slice(1)}
              {compareHistorical && <Badge variant="secondary">YoY Comparison</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {compareHistorical && summaryData.historical_comparison ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background min-w-[150px]">
                        {summaryData.meta.dimension.charAt(0).toUpperCase() + summaryData.meta.dimension.slice(1)}
                      </TableHead>
                      {summaryData.historical_comparison.columns.map(col => (
                        <TableHead key={col.current} className="text-center" colSpan={3}>
                          <div className="text-xs text-muted-foreground">{col.historical}</div>
                          <div>{col.current}</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold" colSpan={3}>Total</TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableHead className="sticky left-0 bg-muted/50"></TableHead>
                      {summaryData.historical_comparison.columns.map(col => (
                        <>
                          <TableHead key={`${col.current}-cur`} className="text-center text-xs">Current</TableHead>
                          <TableHead key={`${col.current}-prev`} className="text-center text-xs">Prev</TableHead>
                          <TableHead key={`${col.current}-yoy`} className="text-center text-xs">YoY</TableHead>
                        </>
                      ))}
                      <TableHead className="text-center text-xs">Current</TableHead>
                      <TableHead className="text-center text-xs">Prev</TableHead>
                      <TableHead className="text-center text-xs">YoY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryData.historical_comparison.rows.slice(0, 20).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="sticky left-0 bg-background font-medium max-w-[200px] truncate" title={row.dimension}>
                          {row.dimension}
                        </TableCell>
                        {summaryData.historical_comparison.columns.map(col => {
                          const periodData = row.periods[col.current] || { current: 0, historical: 0, yoy_change: 0 };
                          return (
                            <>
                              <TableCell key={`${col.current}-cur-${idx}`} className="text-center">{periodData.current}</TableCell>
                              <TableCell key={`${col.current}-prev-${idx}`} className="text-center text-muted-foreground">{periodData.historical}</TableCell>
                              <TableCell key={`${col.current}-yoy-${idx}`} className={`text-center ${getYoYClass(periodData.yoy_change)}`}>
                                <div className="flex items-center justify-center gap-1">
                                  {getYoYIcon(periodData.yoy_change)}
                                  {periodData.yoy_change}%
                                </div>
                              </TableCell>
                            </>
                          );
                        })}
                        <TableCell className="text-center font-medium">{row.total}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{row.hist_total}</TableCell>
                        <TableCell className={`text-center font-medium ${getYoYClass(row.yoy_change)}`}>
                          <div className="flex items-center justify-center gap-1">
                            {getYoYIcon(row.yoy_change)}
                            {row.yoy_change}%
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {summaryData.historical_comparison.rows.length > 20 && (
                      <TableRow>
                        <TableCell colSpan={summaryData.historical_comparison.columns.length * 3 + 4} className="text-center text-muted-foreground py-4">
                          ... and {summaryData.historical_comparison.rows.length - 20} more rows (export to Excel for full data)
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted font-bold">
                      <TableCell className="sticky left-0 bg-muted">Total</TableCell>
                      {summaryData.historical_comparison.columns.map(col => {
                        const totals = summaryData.historical_comparison.column_totals[col.current] || { current: 0, historical: 0, yoy_change: 0 };
                        return (
                          <>
                            <TableCell key={`${col.current}-total-cur`} className="text-center">{totals.current}</TableCell>
                            <TableCell key={`${col.current}-total-prev`} className="text-center text-muted-foreground">{totals.historical}</TableCell>
                            <TableCell key={`${col.current}-total-yoy`} className={`text-center ${getYoYClass(totals.yoy_change)}`}>
                              <div className="flex items-center justify-center gap-1">
                                {getYoYIcon(totals.yoy_change)}
                                {totals.yoy_change}%
                              </div>
                            </TableCell>
                          </>
                        );
                      })}
                      <TableCell className="text-center">{summaryData.historical_comparison.grand_total.current}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{summaryData.historical_comparison.grand_total.historical}</TableCell>
                      <TableCell className={`text-center ${getYoYClass(summaryData.historical_comparison.grand_total.yoy_change)}`}>
                        <div className="flex items-center justify-center gap-1">
                          {getYoYIcon(summaryData.historical_comparison.grand_total.yoy_change)}
                          {summaryData.historical_comparison.grand_total.yoy_change}%
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">
                        {summaryData.meta.dimension.charAt(0).toUpperCase() + summaryData.meta.dimension.slice(1)}
                      </TableHead>
                      {summaryData.pivot_table.columns.map(col => (
                        <TableHead key={col} className="text-center">{col}</TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryData.pivot_table.rows.slice(0, 25).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="sticky left-0 bg-background font-medium max-w-[200px] truncate" title={row.dimension}>
                          {row.dimension}
                        </TableCell>
                        {summaryData.pivot_table.columns.map(col => (
                          <TableCell key={col} className="text-center">{row.periods[col] || 0}</TableCell>
                        ))}
                        <TableCell className="text-center font-medium">{row.total}</TableCell>
                      </TableRow>
                    ))}
                    {summaryData.pivot_table.rows.length > 25 && (
                      <TableRow>
                        <TableCell colSpan={summaryData.pivot_table.columns.length + 2} className="text-center text-muted-foreground py-4">
                          ... and {summaryData.pivot_table.rows.length - 25} more rows (export to Excel for full data)
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted font-bold">
                      <TableCell className="sticky left-0 bg-muted">Total</TableCell>
                      {summaryData.pivot_table.columns.map(col => (
                        <TableCell key={col} className="text-center">{summaryData.pivot_table.column_totals[col] || 0}</TableCell>
                      ))}
                      <TableCell className="text-center">{summaryData.pivot_table.grand_total}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No data available for the selected criteria
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SummaryBuilder;
