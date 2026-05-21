import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedProfile, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Auto-clear stale impersonation when the admin is back on the admin dashboard.
  useEffect(() => {
    if (isImpersonating && pathname === '/admin') {
      stopImpersonation();
    }
  }, [isImpersonating, pathname, stopImpersonation]);

  if (!isImpersonating || pathname === '/admin') return null;

  const label =
    impersonatedProfile?.practice_name || impersonatedProfile?.email || 'client account';

  return (
    <div className="sticky top-0 z-[60] w-full bg-amber-500 text-amber-950 shadow-md">
      <div className="container mx-auto flex items-center justify-between gap-3 py-2 px-4 text-sm font-medium">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 shrink-0" />
          <span className="truncate">
            Admin view — impersonating <strong>{label}</strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-white hover:bg-white/90 border-amber-900/40 text-amber-950 h-7"
          onClick={() => {
            stopImpersonation();
            navigate('/admin');
          }}
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Exit impersonation
        </Button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
