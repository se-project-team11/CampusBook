import type { ReactNode } from 'react';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '📭', title, subtitle, action }: Props) {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
