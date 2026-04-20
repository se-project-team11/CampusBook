import { useState, useEffect } from 'react';
import type { Resource } from '../types';
import { apiClient } from '../services/api';
import { ResourceCard } from './ResourceCard';
import { Spinner } from './ui/Spinner';

const RESOURCE_TYPES = ['STUDY_ROOM', 'LAB', 'SPORTS', 'SEMINAR'];

interface Props {
  onSelect: (resource: Resource) => void;
}

export function ResourceSearch({ onSelect }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [capacityFilter, setCapacityFilter] = useState('');

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.resources.search({
        type: typeFilter || undefined,
        location: locationFilter || undefined,
        capacity: capacityFilter ? parseInt(capacityFilter) : undefined,
      });
      setResources(res.data);
    } catch {
      setError('Failed to load resources. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  return (
    <div>
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
          Filter Resources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Types</option>
            {RESOURCE_TYPES.map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Location (e.g. North Library)"
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
          />

          <input
            type="number"
            placeholder="Min capacity"
            value={capacityFilter}
            onChange={e => setCapacityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={search}
          className="mt-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
        >
          Search
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {!loading && !error && resources.length === 0 && (
        <p className="text-center text-gray-400 py-12">No resources found. Try adjusting filters.</p>
      )}
      {!loading && resources.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(r => (
            <ResourceCard key={r.id} resource={r} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
