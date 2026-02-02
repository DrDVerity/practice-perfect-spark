import React from 'react';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Shield, Sparkles, Clock } from 'lucide-react';

interface LoginWallProps {
  onGoogleLogin: () => void;
  onClose: () => void;
}

export const LoginWall: React.FC<LoginWallProps> = ({ onGoogleLogin, onClose }) => {
  const benefits = [
    { icon: Sparkles, text: 'Save & edit all generated assets' },
    { icon: Clock, text: 'Schedule posts across platforms' },
    { icon: Shield, text: 'Secure cloud storage for your campaigns' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Sign In to Continue
          </h2>
          <p className="text-muted-foreground">
            Create a free account to download, edit, and schedule your campaigns
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {benefits.map((benefit) => (
            <div
              key={benefit.text}
              className="flex items-center gap-3 p-3 rounded-lg bg-accent/50"
            >
              <benefit.icon className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{benefit.text}</span>
            </div>
          ))}
        </div>

        <Button
          variant="google"
          size="xl"
          className="w-full"
          onClick={onGoogleLogin}
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};
