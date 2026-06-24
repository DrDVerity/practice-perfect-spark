import React from 'react';
import logo from '@/assets/archer/archer-logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-18',
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img src={logo} alt="Archer Dental Marketing" className={`${sizes[size]} w-auto`} />
    </div>
  );
};
