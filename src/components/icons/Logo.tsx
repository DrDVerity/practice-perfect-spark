import React from 'react';
import { Link } from 'react-router-dom';
import logo from '@/assets/archer/archer-logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'h-12',
    md: 'h-16',
    lg: 'h-20',
  };

  return (
    <Link to="/" aria-label="Return to Archer home" className={`flex items-center ${className}`}>
      <img src={logo} alt="Archer Dental Marketing" className={`${sizes[size]} w-auto`} />
    </Link>
  );
};
