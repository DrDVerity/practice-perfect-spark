import React from 'react';
import logo from '@/assets/archer/archer-logo.png';

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
    <div className={`flex items-center ${className}`}>
      <img src={logo} alt="Archer Dental Marketing" className={`${sizes[size]} w-auto`} />
    </div>
  );
};
