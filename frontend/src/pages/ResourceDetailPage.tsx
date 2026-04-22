import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import type { AvailabilitySlot, Resource } from '../types';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { BookingForm } from '../components/BookingForm';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';

const typeIcons: Record<string, string> = {
  STUDY_ROOM: '📚', LAB: '🔬', SPORTS: '⚽', SEMINAR: '🎓',
};

export function ResourceDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [resource, setResource] = useState<Resource | undefined>(
    location.state?.resource as Resource | undefined,
  );
  const [fetchError, setFetchError] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  useEffect(() => {
    if (resource || !paramId) return;
    apiClient.resources.getById(paramId)
      .then(res => setResource(res.data))
      .catch(() => setFetchError(true));
  }, [paramId, resource]);

  const closeForm = () => {
    setSelectedSlot(null);
    setGridRefreshKey(k => k + 1);
  };

  if (!resource && !fetchError) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!resource || fetchError) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500 mb-4">Resource not found.</p>
        <Link to="/" className="text-brand-600 underline">Back to search</Link>
      </div>
    );
  }

  const canBook = user?.role === 'ROLE_STUDENT' || user?.role === 'ROLE_FACULTY';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-brand-600 mb-6 flex items-center gap-1"
      >
        ← Back to search
      </button>

      {/* Resource header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{typeIcons[resource.type] ?? '🏫'}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{resource.name}</h1>
              <span className="text-xs bg-brand-50 text-brand-700 font-medium px-2.5 py-1 rounded-full">
                {resource.type.replace('_', ' ')}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">{resource.location}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              <span>👥 Capacity: <strong>{resource.capacity}</strong></span>
              {resource.amenities?.length > 0 && (
                <span>✓ {resource.amenities.join(', ')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      {canBook ? (
        <AvailabilityGrid resource={resource} onBook={setSelectedSlot} refreshKey={gridRefreshKey} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          Only students and faculty can book resources. You are logged in as <strong>{user?.role}</strong>.
        </div>
      )}

      {/* Booking modal */}
      {selectedSlot && (
        <BookingForm
          resource={resource}
          slot={selectedSlot}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
