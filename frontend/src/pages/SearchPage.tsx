import { useNavigate } from 'react-router-dom';
import type { Resource } from '../types';
import { ResourceSearch } from '../components/ResourceSearch';

export function SearchPage() {
  const navigate = useNavigate();

  const handleSelect = (resource: Resource) => {
    navigate(`/resources/${resource.id}`, { state: { resource } });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Find a Resource</h1>
        <p className="text-gray-500 mt-1 text-sm">Search and book campus study rooms, labs, sports facilities, and seminar halls.</p>
      </div>
      <ResourceSearch onSelect={handleSelect} />
    </div>
  );
}
