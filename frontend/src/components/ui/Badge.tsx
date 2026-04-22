type Color = 'blue' | 'green' | 'red' | 'amber' | 'gray';

const STATE_VARIANTS: Record<string, string> = {
  CONFIRMED:  'bg-green-100 text-green-700',
  CHECKED_IN: 'bg-blue-100 text-blue-700',
  RELEASED:   'bg-gray-100 text-gray-600',
  NO_SHOW:    'bg-red-100 text-red-600',
  RESERVED:   'bg-yellow-100 text-yellow-700',
  AVAILABLE:  'bg-emerald-100 text-emerald-700',
  BOOKED:     'bg-red-100 text-red-600',
};

const COLOR_VARIANTS: Record<Color, string> = {
  blue:  'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  red:   'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  gray:  'bg-gray-100 text-gray-600',
};

interface Props {
  label: string;
  color?: Color;
}

export function Badge({ label, color }: Props) {
  const cls = color
    ? COLOR_VARIANTS[color]
    : (STATE_VARIANTS[label] ?? 'bg-gray-100 text-gray-600');
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
  );
}
