import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Bell, X, AlertTriangle, Calendar, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const Header = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCounts, setNotifCounts] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef(null);

  // Fetch notification counts on mount and every 60 seconds
  useEffect(() => {
    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotificationCounts = async () => {
    try {
      const res = await axios.get(`${API}/notifications/summary`, { withCredentials: true });
      setNotifCounts(res.data);
    } catch (err) {
      console.error('Failed to fetch notification counts:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`, { withCredentials: true });
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    try {
      const res = await axios.get(`${API}/leads?search=${encodeURIComponent(query)}&limit=10`, {
        withCredentials: true
      });
      setSearchResults(res.data.leads || []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (lead) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(`/leads?search=${encodeURIComponent(lead.name || lead.enquiry_no)}`);
  };

  const handleNotificationClick = (notif) => {
    setNotifOpen(false);
    navigate(`/leads?search=${encodeURIComponent(notif.lead_name || notif.lead_id)}`);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Calendar className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationBg = (type) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20';
      case 'warning':
        return 'bg-amber-50 border-amber-200 dark:bg-amber-950/20';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20';
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
      {/* Global Search */}
      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads, dealers, employees..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowResults(false);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 dark:bg-slate-900 dark:border-slate-700">
            <ScrollArea className="max-h-80">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground">Searching...</div>
              ) : searchResults.length > 0 ? (
                <div className="py-2">
                  {searchResults.map((lead, idx) => (
                    <button
                      key={lead.lead_id || idx}
                      onClick={() => handleResultClick(lead)}
                      className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-medium">{lead.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {lead.dealer} • {lead.state} • {lead.enquiry_stage}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">No results found</div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Notifications Bell */}
      <Popover open={notifOpen} onOpenChange={(open) => {
        setNotifOpen(open);
        if (open) fetchNotifications();
      }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notifCounts.total > 0 && (
              <span className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white",
                notifCounts.critical > 0 ? "bg-red-500 animate-pulse" : "bg-primary"
              )}>
                {notifCounts.total > 99 ? '99+' : notifCounts.total}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="end">
          <div className="p-4 border-b">
            <h4 className="font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Follow-up Notifications
            </h4>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(notifCounts.critical > 0 || notifCounts.warning > 0) && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {notifCounts.critical + notifCounts.warning} Overdue
                </Badge>
              )}
              {notifCounts.info > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {notifCounts.info} Upcoming
                </Badge>
              )}
            </div>
          </div>
          <ScrollArea className="max-h-[400px]">
            {/* OVERDUE SECTION */}
            {notifications.filter(n => n.type === 'critical' || n.type === 'warning').length > 0 && (
              <div>
                <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 flex items-center justify-between">
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    OVERDUE FOLLOW-UPS
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('Clear all overdue follow-ups? This will remove follow-up dates from these leads.')) {
                        try {
                          const res = await axios.post(`${API}/notifications/dismiss-all`, { type: 'overdue' }, { withCredentials: true });
                          toast.success(res.data.message);
                          fetchNotifications();
                          fetchNotificationCounts();
                        } catch (err) {
                          toast.error('Failed to clear notifications');
                        }
                      }
                    }}
                  >
                    Clear Overdue
                  </Button>
                </div>
                <div className="divide-y">
                  {notifications.filter(n => n.type === 'critical' || n.type === 'warning').slice(0, 10).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full p-3 text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-red-700 dark:text-red-400">
                            {notif.type === 'warning' ? '📅 Due TODAY' : `⚠️ ${notif.days_overdue} days overdue`}
                          </div>
                          <div className="text-sm truncate">{notif.lead_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {notif.dealer} • {notif.followup_date}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* UPCOMING SECTION */}
            {notifications.filter(n => n.type === 'info').length > 0 && (
              <div>
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-t border-blue-200 dark:border-blue-900">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    UPCOMING FOLLOW-UPS
                  </span>
                </div>
                <div className="divide-y">
                  {notifications.filter(n => n.type === 'info').slice(0, 10).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full p-3 text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors border-l-4 border-l-blue-500"
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-blue-700 dark:text-blue-400">
                            In {notif.days_until} day{notif.days_until !== 1 ? 's' : ''}
                          </div>
                          <div className="text-sm truncate">{notif.lead_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {notif.dealer} • {notif.followup_date}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {notifications.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending follow-ups</p>
                <p className="text-xs mt-1">Closed leads are excluded</p>
              </div>
            )}
          </ScrollArea>
          {notifications.length > 0 && (
            <div className="p-2 border-t space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={async () => {
                  if (window.confirm('Clear ALL notifications? This will remove follow-up dates from leads.')) {
                    try {
                      await axios.post(`${API}/notifications/dismiss-all`, { type: 'all' }, { withCredentials: true });
                      fetchNotifications();
                      fetchNotificationCounts();
                    } catch (err) {
                      console.error('Failed to clear notifications:', err);
                    }
                  }
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear All Notifications
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setNotifOpen(false);
                  navigate('/leads');
                }}
              >
                View All Leads
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
