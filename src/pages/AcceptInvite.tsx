import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signInWithGoogle } = useAuth();
  const { refresh } = useWorkspace();
  const [invite, setInvite] = useState<any | null>(null);
  const [accountName, setAccountName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase
        .rpc('get_invite_preview', { _token: token })
        .maybeSingle();
      if (error || !data) {
        setError('Invite not found or expired.');
      } else if ((data as any).accepted_at) {
        setError('This invite has already been used.');
      } else if (new Date((data as any).expires_at) < new Date()) {
        setError('This invite has expired.');
      } else {
        setInvite(data);
        setAccountName((data as any).account_name || 'a workspace');
      }
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!user || !invite || !token) return;
    setAccepting(true);
    try {
      if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        toast.error(`Sign in as ${invite.email} to accept this invite`);
        setAccepting(false);
        return;
      }

      const { error: rpcError } = await supabase.rpc('accept_account_invite', { _token: token });
      if (rpcError) throw rpcError;

      toast.success(`Joined ${accountName}`);
      await refresh();
      navigate('/dashboard');
    } catch (e: any) {
      toast.error('Could not accept invite', { description: e.message });
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {error ? <><AlertCircle className="text-destructive" /> Invite unavailable</>
                   : <><CheckCircle2 className="text-primary" /> You're invited</>}
          </CardTitle>
          <CardDescription>
            {error || `${invite?.email} has been invited to join ${accountName}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Button variant="outline" onClick={() => navigate('/')}>Go home</Button>
          ) : !user ? (
            <Button onClick={signInWithGoogle} className="w-full">
              Sign in with Google to accept
            </Button>
          ) : (
            <Button onClick={accept} disabled={accepting} className="w-full">
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Join ${accountName}`}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
