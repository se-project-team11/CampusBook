import type { Resource } from '../types';

const typeIcons: Record<string, string> = {
  STUDY_ROOM: '📚',
  LAB:        '🔬',
  SPORTS:     '⚽',
  SEMINAR:    '🎓',
};

interface Props {
  resource: Resource;
  onSelect: (r: Resource) => void;
}

export function ResourceCard({ resource, onSelect }: Props) {
  return (
    <div
      onClick={() => onSelect(resource)}
      className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-brand-300 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{typeIcons[resource.type] ?? '🏫'}</span>
        <span className="text-xs bg-brand-50 text-brand-700 font-medium px-2.5 py-1 rounded-full">
          {resource.type.replace('_', ' ')}
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 text-base mb-1">{resource.name}</h3>
      <p className="text-sm text-gray-500 mb-3">{resource.location}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>👥 {resource.capacity} capacity</span>
        {resource.amenities?.length > 0 && (
          <span>✓ {resource.amenities.slice(0, 2).join(', ')}</span>
        )}
      </div>
    </div>
  );
}
