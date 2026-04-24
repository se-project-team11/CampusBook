import type { CSSProperties } from 'react';
import type { Resource } from '../types';

const TYPE_LABEL: Record<string, string> = {
  STUDY_ROOM: 'Study Room',
  LAB:        'Lab',
  SPORTS:     'Sports',
  SEMINAR:    'Seminar Hall',
};

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  STUDY_ROOM: { bg: '#eaf7f5', color: '#1e7a88' },
  LAB:        { bg: '#f0ebfa', color: '#6a3fb5' },
  SPORTS:     { bg: '#edf7ee', color: '#267040' },
  SEMINAR:    { bg: '#fff3da', color: '#b07020' },
};

function TypeIcon({ type }: { type: string }) {
  const color = TYPE_COLOR[type]?.color ?? '#6b7a8d';
  if (type === 'STUDY_ROOM') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
  if (type === 'LAB') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-3 6h12l-3-6V3"/>
    </svg>
  );
  if (type === 'SPORTS') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

interface Props {
  resource: Resource;
  onSelect: (r: Resource) => void;
}

export function ResourceCard({ resource, onSelect }: Props) {
  const tc = TYPE_COLOR[resource.type] ?? { bg: '#f2f4f8', color: '#6b7a8d' };

  return (
    <div
      onClick={() => onSelect(resource)}
      style={{
        background: 'white',
        borderRadius: 20,
        padding: 22,
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        border: '1.5px solid transparent',
        transition: 'box-shadow 0.18s, border-color 0.18s',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      } as CSSProperties}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(76,168,176,0.15)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#4ca8b0';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
      }}
    >
      {/* Type badge row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: tc.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <TypeIcon type={resource.type} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          color: tc.color, background: tc.bg,
          padding: '4px 10px', borderRadius: 20,
          textTransform: 'uppercase',
        }}>
          {TYPE_LABEL[resource.type] ?? resource.type.replace('_', ' ')}
        </span>
      </div>

      {/* Name & location */}
      <p style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', margin: '0 0 4px', lineHeight: 1.3 }}>
        {resource.name}
      </p>
      <p style={{ fontSize: 12, color: '#6b7a8d', margin: '0 0 14px' }}>{resource.location}</p>

      {/* Capacity & amenities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#6b7a8d', paddingTop: 12, borderTop: '1px solid #f0f2f5' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ca8b0" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {resource.capacity}
        </span>
        {resource.amenities?.length > 0 && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9aa5b4' }}>
            {resource.amenities.slice(0, 2).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
