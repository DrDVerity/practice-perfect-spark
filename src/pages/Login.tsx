import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import loginBg from '@/assets/login-bg.jpg';

const Login = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin, isManager, userRole, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (!authLoading && user) {
      // Role-based redirect: admin/manager → /admin, user → /dashboard
      if (isAdmin || isManager) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, authLoading, isAdmin, isManager, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      toast.error('Sign in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningUp(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Account created! You can now sign in.');
        setMode('login');
      }
    } catch (err) {
      toast.error('Sign up failed');
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error('Google sign-in failed');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-cover bg-center"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <Logo />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Sign in to your dental marketing platform'
                : 'Create a new account to get started'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon className="w-5 h-5" />
              Continue with Google
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <form onSubmit={mode === 'login' ? handleEmailLogin : handleEmailSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`pl-10 ${mode === 'signup' ? 'bg-green-100' : ''}`}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-10 ${mode === 'signup' ? 'bg-green-100' : ''}`}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isSigningIn || isSigningUp}
                className={
                  mode === 'signup'
                    ? 'w-full bg-blue-500 hover:bg-blue-600 text-red-500'
                    : 'w-full'
                }
                style={mode === 'signup' ? { textShadow: '1px 1px 0 #000' } : undefined}
              >
                {(isSigningIn || isSigningUp) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <Button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="ml-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1 h-auto text-sm rounded-full shadow-md hover:shadow-lg transition-all"
                  >
                    Sign Up Here{' '}
                    <span
                      className="ml-1 text-red-500"
                      style={{ textShadow: '1px 1px 0 #000' }}
                    >
                      it's Free!
                    </span>
                  </Button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/50 py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Synergy Dental Marketing. Powered by AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Login;
