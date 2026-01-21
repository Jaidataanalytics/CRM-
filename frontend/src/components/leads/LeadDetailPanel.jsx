import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { X, User, Phone, Mail, MapPin, Calendar, Building, Package, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGE_COLORS = {
  'New': 'bg-blue-100 text-blue-800',
  'Contacted': 'bg-yellow-100 text-yellow-800',
  'Qualified': 'bg-purple-100 text-purple-800',
  'Proposal': 'bg-indigo-100 text-indigo-800',
  'Negotiation': 'bg-orange-100 text-orange-800',
  'Closed-Won': 'bg-green-100 text-green-800',
  'Closed-Lost': 'bg-red-100 text-red-800',
  'Order Booked': 'bg-green-100 text-green-800'
};

const TYPE_COLORS = {
  'Hot': 'bg-red-500 text-white',
  'Warm': 'bg-amber-500 text-white',
  'Cold': 'bg-blue-500 text-white'
};

const LeadDetailPanel = ({ lead, onClose, onEdit }) => {
  const [callRemarks, setCallRemarks] = useState([]);
  const [loadingRemarks, setLoadingRemarks] = useState(false);

  useEffect(() => {
    if (lead) {
      loadCallRemarks();
    }
  }, [lead]);

  const loadCallRemarks = async () => {
    if (!lead?._id && !lead?.enquiry_no) return;
    setLoadingRemarks(true);
    try {
      const identifier = lead._id || lead.enquiry_no;
      const res = await axios.get(`${API}/leads/${identifier}/remarks`, { withCredentials: true });
      setCallRemarks(res.data.remarks || []);
    } catch (error) {
      console.error('Error loading remarks:', error);
    } finally {
      setLoadingRemarks(false);
    }
  };

  if (!lead) return null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Lead Details</CardTitle>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(lead)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            {/* Header Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">{lead.name || 'N/A'}</h3>
                <Badge className={TYPE_COLORS[lead.enquiry_type] || 'bg-gray-500'}>
                  {lead.enquiry_type}
                </Badge>
              </div>
              <Badge className={STAGE_COLORS[lead.enquiry_stage] || 'bg-gray-100 text-gray-800'}>
                {lead.enquiry_stage}
              </Badge>
              {lead.is_transferred_lead && (
                <Badge variant="outline" className="ml-2">↔ Transferred</Badge>
              )}
            </div>

            <Separator />

            {/* Contact Info */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Contact Information</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.phone_number || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{[lead.area, lead.district, lead.state].filter(Boolean).join(', ') || 'N/A'}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Lead Info */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Lead Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Enquiry No</p>
                  <p className="font-medium">{lead.enquiry_no || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">KVA</p>
                  <p className="font-medium">{lead.kva || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Segment</p>
                  <p className="font-medium">{lead.segment || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="font-medium">{lead.source || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dealer</p>
                  <p className="font-medium">{lead.dealer || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="font-medium">{lead.employee_name || 'N/A'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Timeline</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Enquiry Date</p>
                  <p className="font-medium">{lead.enquiry_date || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Follow-up Date</p>
                  <p className="font-medium">{lead.followup_date || 'N/A'}</p>
                </div>
                {lead.eo_po_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">PO Date</p>
                    <p className="font-medium">{lead.eo_po_date}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks */}
            {lead.remarks && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Remarks</h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">{lead.remarks}</p>
                </div>
              </>
            )}

            {/* Call Remarks */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Call History ({callRemarks.length})
              </h4>
              {loadingRemarks ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : callRemarks.length > 0 ? (
                <div className="space-y-2">
                  {callRemarks.map((remark, idx) => (
                    <div key={idx} className="bg-muted p-3 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{remark.added_by || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(remark.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p>{remark.remark}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No call history</p>
              )}
            </div>

            {/* Qualification Status */}
            {lead.is_qualified !== undefined && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Qualification</h4>
                  <div className="flex items-center gap-2">
                    {lead.is_qualified ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" /> Qualified
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">
                        <XCircle className="h-3 w-3 mr-1" /> Not Qualified
                      </Badge>
                    )}
                    {lead.qualification_score !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        Score: {lead.qualification_score}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LeadDetailPanel;
