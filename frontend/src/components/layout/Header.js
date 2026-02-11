import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Bell, X, AlertTriangle, Calendar, Clock, ExternalLink, MapPin, Building2, User, Users, Phone, Mail, FileText, Edit, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSidebar } from './Sidebar';

const API = '/api';

export const Header = () => {
  const navigate = useNavigate();
  const { setMobileOpen } = useSidebar();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ leads: [], entities: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCounts, setNotifCounts] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef(null);
  
  // Lead detail modal state
  const [selectedLead, setSelectedLead] = useState(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  const entityIcons = {
    state: MapPin,
    dealer: Building2,
    city: MapPin,
    employee: User
  };

  const entityColors = {
    state: 'bg-blue-100 text-blue-700',
    dealer: 'bg-purple-100 text-purple-700',
    city: 'bg-green-100 text-green-700',
    employee: 'bg-orange-100 text-orange-700'
  };

  // Fetch notification counts on mount and every 2 minutes
  useEffect(() => {
    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 120000); // Poll every 2 minutes
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
      setSearchResults({ leads: [], entities: [] });
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    try {
      // Search both leads and entities in parallel
      const [leadsRes, entitiesRes] = await Promise.all([
        axios.get(`${API}/leads?search=${encodeURIComponent(query)}&limit=5`, { withCredentials: true }),
        axios.get(`${API}/entity/search?q=${encodeURIComponent(query)}`, { withCredentials: true })
      ]);
      
      setSearchResults({
        leads: leadsRes.data.leads || [],
        entities: entitiesRes.data.results || []
      });
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults({ leads: [], entities: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLeadClick = (lead) => {
    setShowResults(false);
    setSearchQuery('');
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleEditLead = () => {
    setIsLeadModalOpen(false);
    navigate(`/leads?edit=${selectedLead?.lead_id}`);
  };

  const handleViewInManageLeads = () => {
    setIsLeadModalOpen(false);
    navigate(`/leads?search=${encodeURIComponent(selectedLead?.name || selectedLead?.enquiry_no)}`);
  };

  const handleEntityClick = (entity) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(`/profile/${entity.type}/${encodeURIComponent(entity.id)}`);
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
    <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0"
        onClick={() => setMobileOpen(true)}
        data-testid="mobile-menu-btn"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Global Search */}
      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads, dealers..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            className="pl-10 pr-10 text-sm"
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
            <ScrollArea className="max-h-96">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground">Searching...</div>
              ) : (searchResults.entities.length > 0 || searchResults.leads.length > 0) ? (
                <div>
                  {/* Entities Section */}
                  {searchResults.entities.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                        STATES, DEALERS, CITIES & EMPLOYEES
                      </div>
                      {searchResults.entities.map((entity, idx) => {
                        const Icon = entityIcons[entity.type] || MapPin;
                        return (
                          <button
                            key={`${entity.type}-${entity.id}-${idx}`}
                            onClick={() => handleEntityClick(entity)}
                            className="w-full px-4 py-3 text-left hover:bg-muted flex items-center justify-between group border-b last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", entityColors[entity.type])}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{entity.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs capitalize">{entity.type}</Badge>
                                  {entity.state && entity.type !== 'state' && <span>• {entity.state}</span>}
                                  {entity.dealer && entity.type === 'employee' && <span>• {entity.dealer}</span>}
                                  <span>• {entity.lead_count} leads</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
                              View Profile <ExternalLink className="h-3 w-3" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Leads Section */}
                  {searchResults.leads.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                        LEADS
                      </div>
                      {searchResults.leads.map((lead, idx) => (
                        <button
                          key={lead.lead_id || idx}
                          onClick={() => handleLeadClick(lead)}
                          className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between group border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                              <Users className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{lead.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                {lead.dealer} • {lead.state} • {lead.enquiry_stage}
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
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
        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[420px] p-0 max-h-[80vh] flex flex-col" align="end">
          <div className="p-4 border-b shrink-0">
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
          <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: '400px' }}>
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
          <div className="p-2 border-t">
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
        </PopoverContent>
      </Popover>

      {/* Lead Detail Modal */}
      <Dialog open={isLeadModalOpen} onOpenChange={setIsLeadModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lead Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-4">
              {/* Lead Name & Status */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{selectedLead.name || 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground">{selectedLead.enquiry_no}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={selectedLead.enquiry_status === 'Open' ? 'default' : 'secondary'}>
                    {selectedLead.enquiry_status || 'N/A'}
                  </Badge>
                  <Badge variant="outline">{selectedLead.enquiry_type || 'N/A'}</Badge>
                </div>
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </Label>
                  <p className="font-medium">{selectedLead.phone_number || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </Label>
                  <p className="font-medium text-sm">{selectedLead.email_address || '-'}</p>
                </div>
              </div>

              {/* District & Dealer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> District
                  </Label>
                  <p className="font-medium">{selectedLead.district || selectedLead.state || '-'}{selectedLead.area ? `, ${selectedLead.area}` : ''}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Dealer
                  </Label>
                  <p className="font-medium">{selectedLead.dealer || '-'}</p>
                </div>
              </div>

              {/* Enquiry Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Enquiry Date</Label>
                  <p className="font-medium">{selectedLead.enquiry_date || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stage</Label>
                  <p className="font-medium">{selectedLead.enquiry_stage || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Segment</Label>
                  <p className="font-medium">{selectedLead.segment || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">KVA</Label>
                  <p className="font-medium">{selectedLead.kva || '-'}</p>
                </div>
              </div>

              {/* Follow-up */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Planned Follow-up
                  </Label>
                  <p className={cn(
                    "font-medium",
                    selectedLead.planned_followup_date && new Date(selectedLead.planned_followup_date) < new Date() && selectedLead.enquiry_status === 'Open' && "text-red-600"
                  )}>
                    {selectedLead.planned_followup_date || '-'}
                    {selectedLead.planned_followup_date && new Date(selectedLead.planned_followup_date) < new Date() && selectedLead.enquiry_status === 'Open' && (
                      <span className="ml-2 text-xs text-red-500">(Overdue)</span>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Employee</Label>
                  <p className="font-medium">{selectedLead.employee_name || '-'}</p>
                </div>
              </div>

              {/* Remarks */}
              {selectedLead.remarks && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Remarks
                  </Label>
                  <p className="text-sm bg-muted/50 p-2 rounded">{selectedLead.remarks}</p>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleViewInManageLeads}>
                  View in Manage Leads
                </Button>
                <Button onClick={handleEditLead} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Lead
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
