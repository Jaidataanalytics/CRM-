import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, Phone, Mail, FileEdit, CheckCircle, XCircle, 
  MessageSquare, Calendar, User, ArrowRight, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const activityIcons = {
  created: Plus,
  updated: FileEdit,
  status_change: ArrowRight,
  stage_change: ArrowRight,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: MessageSquare,
  qualified: CheckCircle,
  disqualified: XCircle,
  followup: Clock,
  default: Clock
};

const activityColors = {
  created: 'bg-green-500',
  updated: 'bg-blue-500',
  status_change: 'bg-purple-500',
  stage_change: 'bg-indigo-500',
  call: 'bg-cyan-500',
  email: 'bg-pink-500',
  meeting: 'bg-amber-500',
  note: 'bg-gray-500',
  qualified: 'bg-emerald-500',
  disqualified: 'bg-red-500',
  followup: 'bg-orange-500',
  default: 'bg-slate-500'
};

export const LeadTimeline = ({ leadId, className }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (leadId) {
      loadActivities();
    }
  }, [leadId]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/lead-activity/${leadId}`, { withCredentials: true });
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error('Failed to load activities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = parseISO(dateStr);
      return {
        full: format(date, 'MMM dd, yyyy HH:mm'),
        relative: formatDistanceToNow(date, { addSuffix: true })
      };
    } catch {
      return { full: dateStr, relative: '' };
    }
  };

  const getIcon = (type) => {
    const Icon = activityIcons[type] || activityIcons.default;
    return Icon;
  };

  const getColor = (type) => {
    return activityColors[type] || activityColors.default;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Timeline
          <Badge variant="secondary" className="ml-auto">{activities.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-6">
                {activities.map((activity, idx) => {
                  const Icon = getIcon(activity.activity_type);
                  const dateInfo = formatDate(activity.created_at);
                  
                  return (
                    <div key={activity.activity_id || idx} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={cn(
                        "relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-white",
                        getColor(activity.activity_type)
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{activity.description}</p>
                            {activity.details && (
                              <div className="mt-1 text-sm text-muted-foreground">
                                {typeof activity.details === 'object' ? (
                                  <div className="space-y-1">
                                    {activity.details.old_value && activity.details.new_value && (
                                      <p>
                                        <span className="line-through text-red-500/70">{activity.details.old_value}</span>
                                        {' → '}
                                        <span className="text-green-500">{activity.details.new_value}</span>
                                      </p>
                                    )}
                                    {activity.details.note && <p>{activity.details.note}</p>}
                                  </div>
                                ) : (
                                  <p>{activity.details}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {activity.activity_type?.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{activity.performed_by || 'System'}</span>
                          <span>•</span>
                          <span title={dateInfo.full}>{dateInfo.relative}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p>No activity recorded yet</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
