import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}

const VARIANTS = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
  ghost:     'text-brand-600 hover:bg-brand-50',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  children, onClick, variant = 'primary', size = 'md',
  disabled, loading, fullWidth, type = 'button',
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
    >
      {loading && (
        <Spinner size="sm" color={variant === 'primary' || variant === 'danger' ? 'white' : 'brand'} />
      )}
      {children}
    </button>
  );
}
