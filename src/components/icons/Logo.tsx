import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${sizes[size]} aspect-square rounded-xl bg-brand-gradient flex items-center justify-center shadow-md`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-6 h-6 text-primary-foreground"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-foreground leading-tight">Synergy</span>
        <span className="text-xs text-muted-foreground leading-tight">Dental Marketing</span>
      </div>
    </div>
  );
};
