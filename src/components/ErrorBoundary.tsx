import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <Button onClick={this.reset}>Reload page</Button>
        </div>
      </div>
    );
  }
}
