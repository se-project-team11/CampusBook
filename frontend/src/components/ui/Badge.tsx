const variants: Record<string, string> = {
  CONFIRMED:  'bg-green-100 text-green-700',
  CHECKED_IN: 'bg-blue-100 text-blue-700',
  RELEASED:   'bg-gray-100 text-gray-600',
  NO_SHOW:    'bg-red-100 text-red-600',
  RESERVED:   'bg-yellow-100 text-yellow-700',
  AVAILABLE:  'bg-emerald-100 text-emerald-700',
  BOOKED:     'bg-red-100 text-red-600',
};

export function Badge({ label }: { label: string }) {
  const cls = variants[label] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
  );
}
