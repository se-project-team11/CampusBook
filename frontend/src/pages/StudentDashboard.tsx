import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Booking, WaitlistEntry } from '../types';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';
import { ActiveBookingCard } from '../components/ActiveBookingCard';
import { Badge } from '../components/ui/Badge';
import { WaitlistBadge } from '../components/WaitlistBadge';
import { Link } from 'react-router-dom';

const card: CSSProperties = { background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' };
const cardLabel: CSSProperties = { fontSize: 13, fontWeight: 500, color: '#6b7a8d', margin: 0 };
const bigNum: CSSProperties = { fontSize: 48, fontWeight: 700, color: '#1a2535', lineHeight: 1.1, margin: '8px 0 4px' };
const cardSub: CSSProperties = { fontSize: 12, color: '#9aa5b4', margin: 0 };

export function StudentDashboard() {
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [waitlist, setWaitlist]         = useState<WaitlistEntry[]>([]);
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingsRes, resourcesRes, waitlistRes] = await Promise.all([
        apiClient.bookings.myBookings(),
        apiClient.resources.search(),
        apiClient.waitlist.mine().catch(() => ({ data: { entries: [] } })),
      ]);
      setBookings(bookingsRes.data.bookings);
      setWaitlist(waitlistRes.data.entries);
      const nameMap: Record<string, string> = {};
      for (const r of resourcesRes.data) nameMap[r.id] = r.name;
      setResourceNames(nameMap);
    } catch {
      setError('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const active  = bookings.filter(b => ['CONFIRMED', 'CHECKED_IN'].includes(b.state));
  const pending = bookings.filter(b => b.state === 'RESERVED' && b.requires_approval);
  const history = bookings.filter(b => !['CONFIRMED', 'CHECKED_IN'].includes(b.state) && !(b.state === 'RESERVED' && b.requires_approval));

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size="lg" /></div>;
  }

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2535', margin: 0 }}>My Bookings</h1>
          <p style={{ fontSize: 13, color: '#6b7a8d', margin: '4px 0 0' }}>Manage your campus resource reservations</p>
        </div>
        <Link
          to="/"
          style={{
            padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#4ca8b0', color: 'white', textDecoration: 'none',
            boxShadow: '0 2px 10px rgba(76,168,176,0.3)',
          }}
        >
          + New Booking
        </Link>
      </div>

      {error && (
        <div style={{ background: '#fde8e3', border: '1px solid #f5c6b8', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#c0402c', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 20 }}>

        {/* Hero: active bookings */}
        <div style={{ background: 'linear-gradient(135deg, #a8c5da, #c5dce8)', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1e3a4a', margin: '0 0 2px' }}>Active Bookings</p>
          <p style={{ fontSize: 12, color: '#4a6a7a', margin: '0 0 16px' }}>Confirmed and currently in-use</p>
          {active.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 14, color: '#3a5a6a', margin: '0 0 12px' }}>No active bookings right now.</p>
              <Link to="/" style={{ fontSize: 13, color: '#1e5a70', fontWeight: 600, background: 'rgba(255,255,255,0.5)', padding: '8px 18px', borderRadius: 10, textDecoration: 'none' }}>
                Find a resource
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {active.map(b => (
                <div key={b.booking_id} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 14, overflow: 'hidden' }}>
                  <ActiveBookingCard booking={b} resourceName={resourceNames[b.resource_id]} onCancelled={load} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stat: total bookings */}
        <div style={{ background: '#f5c9b3', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#7a3d2a', margin: 0 }}>Total Bookings</p>
          <p style={bigNum}>{bookings.length}</p>
          <p style={{ fontSize: 12, color: '#8a5040', margin: 0 }}>all time</p>
          <div style={{ flex: 1, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Active',   val: active.length,   color: '#1e7a88' },
              { label: 'Pending',  val: pending.length,  color: '#b07020' },
              { label: 'Waitlist', val: waitlist.length, color: '#6a3fb5' },
              { label: 'History',  val: history.length,  color: '#6b7a8d' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#8a5040' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

        {/* Pending approvals */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={cardLabel}>Pending Approval</p>
            {pending.length > 0 && (
              <span style={{ background: '#fff3da', color: '#b07020', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {pending.length}
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9aa5b4' }}>No pending approvals.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(b => (
                <div key={b.booking_id} style={{ background: '#fffbf0', borderRadius: 12, padding: '10px 12px', border: '1px solid #f0dda0' }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a2535', margin: '0 0 2px' }}>
                    {resourceNames[b.resource_id] ?? b.resource_id.slice(0, 8)}
                  </p>
                  <p style={{ fontSize: 11, color: '#8a6020', margin: '0 0 4px' }}>
                    {new Date(b.slot_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {new Date(b.slot_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p style={{ fontSize: 11, color: '#a07030', margin: 0 }}>Awaiting dept-admin approval</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waitlist */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={cardLabel}>Waitlist</p>
            {waitlist.length > 0 && (
              <span style={{ background: '#f0ebfa', color: '#6a3fb5', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {waitlist.length}
              </span>
            )}
          </div>
          {waitlist.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9aa5b4' }}>Not on any waitlist.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {waitlist.map(w => {
                const s  = new Date(w.slot_start);
                const e  = new Date(w.slot_end);
                const t1 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const t2 = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={w.waitlist_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a2535', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resourceNames[w.resource_id] ?? '—'}
                      </p>
                      <p style={{ fontSize: 11, color: '#6b7a8d', margin: '2px 0 0' }}>{t1} – {t2}</p>
                    </div>
                    <WaitlistBadge position={w.position} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        <div style={card}>
          <p style={{ ...cardLabel, marginBottom: 14 }}>History</p>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9aa5b4' }}>No booking history yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.slice(0, 5).map(b => {
                const s  = new Date(b.slot_start);
                const t1 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const d  = s.toLocaleDateString([], { month: 'short', day: 'numeric' });
                return (
                  <div key={b.booking_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a2535', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resourceNames[b.resource_id] ?? '—'}
                      </p>
                      <p style={{ fontSize: 11, color: '#6b7a8d', margin: '2px 0 0' }}>{t1} · {d}</p>
                    </div>
                    <Badge label={b.state} />
                  </div>
                );
              })}
              {history.length > 5 && (
                <p style={{ fontSize: 11, color: '#9aa5b4', margin: 0 }}>+{history.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
