interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'brand' | 'white' | 'gray';
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
const colors = {
  brand: 'border-brand-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
};

export function Spinner({ size = 'md', color = 'brand' }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} ${colors[color]} rounded-full border-2 animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}
