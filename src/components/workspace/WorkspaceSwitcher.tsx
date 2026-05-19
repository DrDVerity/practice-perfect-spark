import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Plus, Settings } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const WorkspaceSwitcher = () => {
  const { account, locations, activeLocation, setActiveLocation, isLoading } = useWorkspace();
  const navigate = useNavigate();

  if (isLoading || !account) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[260px]">
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-left">
            <span className="block text-xs text-muted-foreground leading-none">{account.name}</span>
            <span className="block text-sm font-medium truncate">
              {activeLocation?.name || 'Select location'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">Switch location</DropdownMenuLabel>
        {locations.map((loc) => (
          <DropdownMenuItem
            key={loc.id}
            onSelect={() => setActiveLocation(loc.id)}
            className={loc.id === activeLocation?.id ? 'bg-accent font-medium' : ''}
          >
            <Building2 className="h-4 w-4 mr-2 opacity-70" />
            {loc.name}
            {loc.is_default && (
              <span className="ml-auto text-[10px] uppercase text-muted-foreground">Default</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings/workspace')}>
          <Plus className="h-4 w-4 mr-2" />
          Add location
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/settings/workspace')}>
          <Settings className="h-4 w-4 mr-2" />
          Manage members
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
