import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
  secondary: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2',
  outline: 'bg-transparent border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500',
};

const sizeStyles = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-md min-h-[34px]',
  md: 'px-3.5 py-2 text-sm gap-2 rounded-lg min-h-[40px]',
  lg: 'px-4.5 py-2.5 text-base gap-2.5 rounded-lg min-h-[46px]',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon: Icon,
    iconRight: IconRight,
    type = 'button',
    className = '',
    onClick,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant] || variantStyles.primary} ${sizeStyles[size] || sizeStyles.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
      {!loading && IconRight ? <IconRight className="w-4 h-4 shrink-0" /> : null}
    </button>
  );
});
