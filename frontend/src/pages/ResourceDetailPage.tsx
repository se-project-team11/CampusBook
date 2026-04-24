import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import type { AvailabilitySlot, Resource } from '../types';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { BookingForm } from '../components/BookingForm';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';

const TYPE_LABEL: Record<string, string> = {
  STUDY_ROOM: 'Study Room', LAB: 'Lab', SPORTS: 'Sports', SEMINAR: 'Seminar Hall',
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
  if (type === 'LAB') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-3 6h12l-3-6V3"/>
    </svg>
  );
  if (type === 'SPORTS') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

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
  const [userBookings, setUserBookings] = useState<{ resource_id: string; slot_start: string; slot_end: string }[]>([]);
  const [userWaitlist, setUserWaitlist] = useState<string[]>([]);

  const canBook = user?.role === 'ROLE_STUDENT' || user?.role === 'ROLE_FACULTY';

  useEffect(() => {
    if (resource || !paramId) return;
    apiClient.resources.getById(paramId)
      .then(res => setResource(res.data))
      .catch(() => setFetchError(true));
  }, [paramId, resource]);

  useEffect(() => {
    if (!canBook) return;
    Promise.all([
      apiClient.bookings.myBookings(),
      apiClient.waitlist.mine(),
    ])
      .then(([bookingsRes, waitlistRes]) => {
        const active = bookingsRes.data.bookings.filter(
          b => b.state === 'CONFIRMED' || b.state === 'RESERVED' || b.state === 'CHECKED_IN'
        );
        setUserBookings(active.map(b => ({ resource_id: b.resource_id, slot_start: b.slot_start, slot_end: b.slot_end })));
        setUserWaitlist(waitlistRes.data.entries.map(e => e.slot_start));
      })
      .catch(console.error);
  }, [canBook, resource?.id]);

  const closeForm = () => {
    setSelectedSlot(null);
    setGridRefreshKey(k => k + 1);
    Promise.all([
      apiClient.bookings.myBookings(),
      apiClient.waitlist.mine(),
    ])
      .then(([bookingsRes, waitlistRes]) => {
        const active = bookingsRes.data.bookings.filter(
          b => b.state === 'CONFIRMED' || b.state === 'RESERVED' || b.state === 'CHECKED_IN'
        );
        setUserBookings(active.map(b => ({ resource_id: b.resource_id, slot_start: b.slot_start, slot_end: b.slot_end })));
        setUserWaitlist(waitlistRes.data.entries.map(e => e.slot_start));
      })
      .catch(console.error);
  };

  if (!resource && !fetchError) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size="lg" /></div>;
  }

  if (!resource || fetchError) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: '#6b7a8d', marginBottom: 12 }}>Resource not found.</p>
        <Link to="/" style={{ color: '#4ca8b0', fontWeight: 600 }}>Back to search</Link>
      </div>
    );
  }

  const tc = TYPE_COLOR[resource.type] ?? { bg: '#f2f4f8', color: '#6b7a8d' };

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 820, fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: '#6b7a8d', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, marginBottom: 22, fontFamily: 'inherit',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to search
      </button>

      {/* Resource header card */}
      <div style={{
        background: 'white', borderRadius: 20, padding: 24,
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)', marginBottom: 20,
      } as CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <TypeIcon type={resource.type} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a2535', margin: 0 }}>{resource.name}</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: tc.color, background: tc.bg, padding: '3px 10px', borderRadius: 20,
              }}>
                {TYPE_LABEL[resource.type] ?? resource.type.replace('_', ' ')}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#6b7a8d', margin: '0 0 12px' }}>{resource.location}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#6b7a8d' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ca8b0" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Capacity: <strong style={{ color: '#1a2535' }}>{resource.capacity}</strong>
              </span>
              {resource.amenities?.length > 0 && (
                <span style={{ color: '#9aa5b4' }}>{resource.amenities.join(', ')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      {canBook ? (
        <AvailabilityGrid resource={resource} onBook={setSelectedSlot} refreshKey={gridRefreshKey} userBookings={userBookings} userWaitlist={userWaitlist} />
      ) : (
        <div style={{ background: '#fff3da', border: '1px solid #f0dda0', borderRadius: 14, padding: '14px 18px', fontSize: 13, color: '#8a6020' }}>
          Only students and faculty can book resources. You are logged in as <strong>{user?.role}</strong>.
        </div>
      )}

      {selectedSlot && (
        <BookingForm resource={resource} slot={selectedSlot} onClose={closeForm} />
      )}
    </div>
  );
}
