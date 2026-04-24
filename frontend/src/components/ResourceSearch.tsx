import { useState, useEffect } from 'react';
import type { Resource } from '../types';
import { apiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ResourceCard } from './ResourceCard';
import { Spinner } from './ui/Spinner';

const RESTRICTED_TYPES: Record<string, string[]> = {
  ROLE_STUDENT: ['STUDY_ROOM', 'LAB', 'SPORTS'],
  ROLE_FACULTY: ['SEMINAR', 'LAB'],
};

const TYPE_LABEL: Record<string, string> = {
  STUDY_ROOM: 'Study Room',
  LAB:        'Lab',
  SPORTS:     'Sports',
  SEMINAR:    'Seminar Hall',
};

const inputStyle = {
  border: '1px solid #e0e4ea',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 13,
  color: '#1a2535',
  background: 'white',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
};

export function ResourceSearch({ onSelect }: { onSelect: (resource: Resource) => void }) {
  const { user } = useAuth();
  const [resources, setResources]       = useState<Resource[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [typeFilter, setTypeFilter]     = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [capacityFilter, setCapacityFilter] = useState('');

  const userTypes = user ? RESTRICTED_TYPES[user.role] ?? [] : [];

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.resources.search({
        type:     typeFilter || undefined,
        location: locationFilter || undefined,
        capacity: capacityFilter ? parseInt(capacityFilter) : undefined,
      });
      const allowedTypes = new Set(userTypes);
      setResources(
        userTypes.length > 0 ? res.data.filter(r => allowedTypes.has(r.type)) : res.data
      );
    } catch {
      setError('Failed to load resources. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        background: 'white', borderRadius: 20, padding: 22,
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)', marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b4', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
          Filter Resources
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="">All Types</option>
            {userTypes.map(t => (
              <option key={t} value={t}>{TYPE_LABEL[t] ?? t.replace('_', ' ')}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Location"
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={inputStyle}
          />

          <input
            type="number"
            placeholder="Min capacity"
            value={capacityFilter}
            onChange={e => setCapacityFilter(e.target.value)}
            style={inputStyle}
          />

          <button
            onClick={search}
            style={{
              padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: '#2d3e50', color: 'white', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <Spinner size="lg" />
        </div>
      )}
      {error && (
        <div style={{ background: '#fde8e3', border: '1px solid #f5c6b8', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#c0402c', marginBottom: 16 }}>
          {error}
        </div>
      )}
      {!loading && !error && resources.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9aa5b4', fontSize: 14, paddingTop: 48 }}>
          No resources found. Try adjusting filters.
        </p>
      )}
      {!loading && resources.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {resources.map(r => (
            <ResourceCard key={r.id} resource={r} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
