import { useNavigate } from 'react-router-dom';
import type { Resource } from '../types';
import { ResourceSearch } from '../components/ResourceSearch';

export function SearchPage() {
  const navigate = useNavigate();

  const handleSelect = (resource: Resource) => {
    navigate(`/resources/${resource.id}`, { state: { resource } });
  };

  return (
    <div style={{ padding: '28px 28px 40px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2535', margin: 0 }}>Find a Resource</h1>
        <p style={{ fontSize: 13, color: '#6b7a8d', margin: '4px 0 0' }}>
          Search and book campus study rooms, labs, sports facilities, and seminar halls.
        </p>
      </div>
      <ResourceSearch onSelect={handleSelect} />
    </div>
  );
}
