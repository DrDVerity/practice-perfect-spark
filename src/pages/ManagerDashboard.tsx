import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Megaphone,
  Bell,
  Mail,
  ArrowLeft,
  Send,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { NavLink } from '@/components/NavLink';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, managedClientIds } = useAuth();
  const { messages, unreadCount, sendMessage, markRead } = useMessages();

  const [showMessages, setShowMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // Fetch assigned client profiles
  const { data: clients = [] } = useQuery({
    queryKey: ['manager-clients', managedClientIds],
    queryFn: async () => {
      if (!managedClientIds.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', managedClientIds);
      if (error) throw error;
      return data || [];
    },
    enabled: managedClientIds.length > 0,
  });

  // Fetch campaigns for managed clients
  const { data: campaigns = [] } = useQuery({
    queryKey: ['manager-campaigns', managedClientIds],
    queryFn: async () => {
      if (!managedClientIds.length) return [];
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('user_id', managedClientIds)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: managedClientIds.length > 0,
  });

  // Campaigns with add-ons (managed campaigns needing attention)
  const { data: managedCampaignAddons = [] } = useQuery({
    queryKey: ['manager-campaign-addons', campaigns.map(c => c.id)],
    queryFn: async () => {
      if (!campaigns.length) return [];
      const { data, error } = await (supabase as any)
        .from('campaign_addons')
        .select('*')
        .in('campaign_id', campaigns.map(c => c.id));
      if (error) throw error;
      return data || [];
    },
    enabled: campaigns.length > 0,
  });

  // Fetch sender/recipient profiles for messages
  const { data: messageProfiles = [] } = useQuery({
    queryKey: ['message-profiles', messages.map(m => m.sender_id + m.recipient_id)],
    queryFn: async () => {
      const ids = [...new Set(messages.flatMap(m => [m.sender_id, m.recipient_id]))];
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, practice_name')
        .in('user_id', ids);
      if (error) throw error;
      return data || [];
    },
    enabled: messages.length > 0,
  });

  const getProfileName = (userId: string) => {
    const p = messageProfiles.find((pr: any) => pr.user_id === userId);
    return p?.practice_name || p?.email || userId.slice(0, 8);
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'scheduled');
  const campaignsWithAddons = campaigns.filter(c =>
    managedCampaignAddons.some((a: any) => a.campaign_id === c.id)
  );

  const handleSend = () => {
    if (!composeRecipient || !composeBody.trim()) return;
    sendMessage.mutate({
      recipient_id: composeRecipient,
      subject: composeSubject,
      body: composeBody,
    }, {
      onSuccess: () => {
        setShowCompose(false);
        setComposeRecipient('');
        setComposeSubject('');
        setComposeBody('');
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
            <span className="text-lg font-semibold text-foreground">Manager Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/knowledge-base">KB</NavLink>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-lg" onClick={() => {}}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10"><Users className="w-6 h-6 text-primary" /></div>
              <div>
                <div className="text-3xl font-bold">{clients.length}</div>
                <div className="text-sm text-muted-foreground">Assigned Clients</div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg" onClick={() => {}}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10"><Megaphone className="w-6 h-6 text-green-600" /></div>
              <div>
                <div className="text-3xl font-bold">{activeCampaigns.length}</div>
                <div className="text-sm text-muted-foreground">Active Campaigns</div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg" onClick={() => {}}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10"><Bell className="w-6 h-6 text-amber-600" /></div>
              <div>
                <div className="text-3xl font-bold">{campaignsWithAddons.length}</div>
                <div className="text-sm text-muted-foreground">Managed Campaigns</div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg" onClick={() => setShowMessages(true)}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10 relative">
                <Mail className="w-6 h-6 text-blue-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <div className="text-3xl font-bold">{unreadCount}</div>
                <div className="text-sm text-muted-foreground">Unread Messages</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Clients */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Assigned Clients</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client: any) => {
              const clientCampaigns = campaigns.filter(c => c.user_id === client.user_id);
              return (
                <Card key={client.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{client.practice_name || client.email || 'Unknown'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{client.email}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{clientCampaigns.length} campaigns</Badge>
                      <Badge variant="outline">{clientCampaigns.filter(c => c.status === 'active').length} active</Badge>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => {
                        setComposeRecipient(client.user_id);
                        setShowCompose(true);
                      }}>
                        <MessageSquare className="w-3 h-3 mr-1" /> Message
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {clients.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">No clients assigned yet.</p>
            )}
          </div>
        </div>

        {/* Managed Campaigns (with add-ons) */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Managed Campaigns (Requiring Budget)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Add-Ons</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignsWithAddons.map((c: any) => {
                const client = clients.find((cl: any) => cl.user_id === c.user_id);
                const addonCount = managedCampaignAddons.filter((a: any) => a.campaign_id === c.id).length;
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaign/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{client?.practice_name || client?.email || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{c.status}</Badge>
                    </TableCell>
                    <TableCell>{addonCount} add-ons</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${c.id}`); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {campaignsWithAddons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No managed campaigns yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* All Active Campaigns */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">All Client Campaigns</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c: any) => {
                const client = clients.find((cl: any) => cl.user_id === c.user_id);
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaign/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{client?.practice_name || client?.email || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.start_date ? format(new Date(c.start_date), 'MMM d') : '—'}
                      {' → '}
                      {c.end_date ? format(new Date(c.end_date), 'MMM d') : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Messages Dialog */}
      <Dialog open={showMessages} onOpenChange={setShowMessages}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" /> Messages
              {unreadCount > 0 && <Badge variant="destructive">{unreadCount} unread</Badge>}
            </DialogTitle>
            <DialogDescription>Your conversations with clients</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => { setShowMessages(false); setShowCompose(true); }}>
              <Send className="w-3 h-3 mr-1" /> Compose
            </Button>
          </div>
          <ScrollArea className="max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg: any) => (
                  <TableRow
                    key={msg.id}
                    className={`cursor-pointer ${!msg.read && msg.recipient_id === user?.id ? 'font-semibold bg-primary/5' : ''}`}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (!msg.read && msg.recipient_id === user?.id) {
                        markRead.mutate(msg.id);
                      }
                    }}
                  >
                    <TableCell>{getProfileName(msg.sender_id)}</TableCell>
                    <TableCell>{msg.subject || '(no subject)'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      {!msg.read && msg.recipient_id === user?.id && (
                        <Badge variant="destructive" className="text-[10px]">New</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {messages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No messages yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={(o) => !o && setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject || '(no subject)'}</DialogTitle>
            <DialogDescription>
              From: {selectedMessage && getProfileName(selectedMessage.sender_id)} — {selectedMessage && format(new Date(selectedMessage.created_at), 'MMM d, yyyy h:mm a')}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm py-4">{selectedMessage?.body}</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setComposeRecipient(selectedMessage?.sender_id);
              setComposeSubject(`Re: ${selectedMessage?.subject || ''}`);
              setSelectedMessage(null);
              setShowMessages(false);
              setShowCompose(true);
            }}>
              Reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <select
                className="w-full border rounded-md p-2 bg-background text-foreground"
                value={composeRecipient}
                onChange={(e) => setComposeRecipient(e.target.value)}
              >
                <option value="">Select client...</option>
                {clients.map((c: any) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.practice_name || c.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Type your message..." rows={5} />
            </div>
            <Button onClick={handleSend} disabled={!composeRecipient || !composeBody.trim() || sendMessage.isPending} className="w-full">
              <Send className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
