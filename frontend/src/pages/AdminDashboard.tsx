import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ActiveBookingOverview, AvailabilitySlot, Booking, Resource } from '../types';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';

const POLL_MS = 30_000;

function OccupancyGauge({ value, max }: { value: number; max: number }) {
  const r = 44, cx = 55, cy = 52;
  const arc = Math.PI * r;
  const offset = arc * (1 - Math.min(value / Math.max(max, 1), 1));
  return (
    <svg viewBox="0 0 110 60" style={{ width: '100%', maxWidth: 160 }}>
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#d95840" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${arc}`} strokeDashoffset={`${offset}`} />
    </svg>
  );
}

const card: CSSProperties = { background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' };
const cardLabel: CSSProperties = { fontSize: 13, fontWeight: 500, color: '#6b7a8d', margin: 0 };
const bigNum: CSSProperties = { fontSize: 48, fontWeight: 700, color: '#1a2535', lineHeight: 1.1, margin: '8px 0 4px' };
const cardSub: CSSProperties = { fontSize: 12, color: '#9aa5b4', margin: 0 };

const STATE_DOT: Record<string, string> = {
  CONFIRMED:  '#4ca8b0',
  CHECKED_IN: '#7c5cbf',
  RESERVED:   '#e0a030',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function RoomSlotPanel({ resourceId }: { resourceId: string }) {
  const [slots, setSlots]   = useState<AvailabilitySlot[] | null>(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    apiClient.resources.availability(resourceId, today)
      .then(res => setSlots(res.data.slots))
      .catch(() => setError(true));
  }, [resourceId]);

  if (error) return <p style={{ fontSize: 11, color: '#c0402c', margin: '8px 0 4px' }}>Could not load slots.</p>;
  if (!slots) return <p style={{ fontSize: 11, color: '#6b7a8d', margin: '8px 0 4px' }}>Loading…</p>;
  if (slots.length === 0) return <p style={{ fontSize: 11, color: '#6b7a8d', margin: '8px 0 4px' }}>No slots today.</p>;

  return (
    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {slots.map(s => {
        const booked = s.status === 'BOOKED';
        return (
          <div
            key={s.slot_start}
            title={booked ? `Booked${s.waitlist_count ? ` · ${s.waitlist_count} waitlisted` : ''}` : 'Available'}
            style={{
              padding: '4px 9px', borderRadius: 8, fontSize: 10.5, fontWeight: 600,
              background: booked ? 'rgba(192,64,44,0.13)' : 'rgba(38,112,64,0.13)',
              color: booked ? '#c0402c' : '#267040',
              whiteSpace: 'nowrap',
            }}
          >
            {fmt(s.slot_start)}–{fmt(s.slot_end)}
            {s.waitlist_count ? <span style={{ marginLeft: 4, opacity: 0.7 }}>+{s.waitlist_count}w</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminDashboard() {
  const [resources, setResources]           = useState<Resource[]>([]);
  const [activeBookings, setActiveBookings] = useState<ActiveBookingOverview[]>([]);
  const [pending, setPending]               = useState<Booking[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom]     = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = (showSpinner = false) => {
    if (showSpinner) setLoading(true); else setRefreshing(true);
    setError(null);
    return Promise.all([
      apiClient.resources.search(),
      apiClient.admin.roomOverview(),
      apiClient.admin.pendingApprovals(),
    ])
      .then(([rRes, oRes, aRes]) => {
        setResources(rRes.data);
        setActiveBookings(oRes.data.bookings);
        setPending(aRes.data.bookings);
        setLastUpdated(new Date());
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  const refresh = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(refresh, POLL_MS);
    fetchData(false);
  };

  useEffect(() => {
    fetchData(true);
    timerRef.current = setInterval(refresh, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const bookingByResource = new Map<string, ActiveBookingOverview>();
  for (const b of activeBookings) bookingByResource.set(b.resource_id, b);

  const freeCount     = resources.filter(r => !bookingByResource.has(r.id)).length;
  const occupiedCount = resources.length - freeCount;
  const sortedRes     = [...resources].sort((a, b) =>
    (bookingByResource.has(a.id) ? 0 : 1) - (bookingByResource.has(b.id) ? 0 : 1)
  );

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size="lg" /></div>;
  }

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2535', margin: 0 }}>Admin Dashboard</h1>
          <p style={{ fontSize: 13, color: '#6b7a8d', margin: '4px 0 0' }}>Department resource management</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#9aa5b4' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh} disabled={refreshing}
            style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 500,
              background: 'white', border: '1px solid #e0e4ea', color: '#4ca8b0',
              cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fde8e3', border: '1px solid #f5c6b8', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#c0402c', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 20 }}>

        {/* Hero: room list */}
        <div style={{ background: 'linear-gradient(135deg, #a8c5da, #c5dce8)', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1e3a4a', margin: '0 0 2px' }}>Room Overview</p>
          <p style={{ fontSize: 12, color: '#4a6a7a', margin: '0 0 16px' }}>
            Live occupancy — {occupiedCount} of {resources.length} in use
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
            {sortedRes.map(r => {
              const booking     = bookingByResource.get(r.id);
              const isCheckedIn = booking?.state === 'CHECKED_IN';
              const isOccupied  = !!booking;
              const isExpanded  = expandedRoom === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setExpandedRoom(isExpanded ? null : r.id)}
                  style={{
                    background: 'rgba(255,255,255,0.55)', borderRadius: 12, padding: '10px 14px',
                    cursor: 'pointer', userSelect: 'none',
                    border: isExpanded ? '1.5px solid rgba(76,168,176,0.5)' : '1.5px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1e3a4a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#4a6a7a', margin: '1px 0 0' }}>{r.location}</p>
                      {booking && (
                        <p style={{ fontSize: 11, color: '#2a4a5a', margin: '1px 0 0' }}>
                          {fmt(booking.slot_start)} – {fmt(booking.slot_end)} · {booking.user_email}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: isCheckedIn ? 'rgba(124,92,191,0.15)' : isOccupied ? 'rgba(76,168,176,0.15)' : 'rgba(80,180,100,0.15)',
                        color: isCheckedIn ? '#6a3fb5' : isOccupied ? '#1e7a88' : '#267040',
                      }}>
                        {isCheckedIn ? 'IN USE' : isOccupied ? 'BOOKED' : 'FREE'}
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="#4a6a7a" strokeWidth="2.5" strokeLinecap="round"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                  {isExpanded && (
                    <div onClick={e => e.stopPropagation()}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#4a6a7a', margin: '10px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Today's slots
                      </p>
                      <RoomSlotPanel resourceId={r.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat: occupancy gauge */}
        <div style={{ background: '#f5c9b3', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#7a3d2a', margin: 0 }}>Occupancy</p>
          <p style={bigNum}>
            {resources.length > 0 ? Math.round((occupiedCount / resources.length) * 100) : 0}%
          </p>
          <p style={{ fontSize: 12, color: '#8a5040', margin: 0 }}>{occupiedCount} of {resources.length} rooms</p>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
            <OccupancyGauge value={occupiedCount} max={resources.length || 1} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#267040', fontWeight: 600 }}>{freeCount} free</span>
            <span style={{ color: '#c0402c', fontWeight: 600 }}>{occupiedCount} occupied</span>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

        {/* KPI summary */}
        <div style={card}>
          <p style={cardLabel}>Total Rooms</p>
          <p style={bigNum}>{resources.length}</p>
          <p style={cardSub}>registered resources</p>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Available', val: freeCount,      color: '#267040' },
              { label: 'Occupied',  val: occupiedCount,  color: '#c0402c' },
              { label: 'Pending',   val: pending.length, color: '#b07020' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b7a8d' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active bookings log */}
        <div style={card}>
          <p style={{ ...cardLabel, marginBottom: 14 }}>Active Now</p>
          {activeBookings.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9aa5b4' }}>No active bookings.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeBookings.slice(0, 5).map(b => (
                <div key={b.booking_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: b.state === 'CHECKED_IN' ? 'rgba(124,92,191,0.12)' : 'rgba(76,168,176,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATE_DOT[b.state] ?? '#4ca8b0' }}>
                      {b.resource_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a2535', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.resource_name}
                    </p>
                    <p style={{ fontSize: 11, color: '#6b7a8d', margin: 0 }}>
                      {fmt(b.slot_start)} – {fmt(b.slot_end)} · {fmtShort(b.slot_start)}
                    </p>
                  </div>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_DOT[b.state] ?? '#4ca8b0', flexShrink: 0, display: 'inline-block' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending approvals */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={cardLabel}>Pending Approvals</p>
            {pending.length > 0 && (
              <span style={{ background: '#fff3da', color: '#b07020', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {pending.length}
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ca8b0" strokeWidth="2" strokeLinecap="round" style={{ margin: '0 auto 8px', display: 'block' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p style={{ fontSize: 13, color: '#6b7a8d', margin: 0 }}>All caught up</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.slice(0, 3).map(b => {
                const resName = resources.find(r => r.id === b.resource_id)?.name ?? b.resource_id.slice(0, 8);
                return (
                  <div key={b.booking_id} style={{ background: '#fafafa', borderRadius: 12, padding: '10px 12px' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1a2535', margin: '0 0 2px' }}>{resName}</p>
                    <p style={{ fontSize: 11, color: '#6b7a8d', margin: '0 0 8px' }}>
                      {b.user_email ?? '—'} · {fmtShort(b.slot_start)}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => apiClient.admin.approve(b.booking_id).then(() => {
                          setPending(prev => prev.filter(x => x.booking_id !== b.booking_id));
                          fetchData(false);
                        })}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: '#eaf7f5', color: '#1e7a88', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => apiClient.admin.reject(b.booking_id).then(() =>
                          setPending(prev => prev.filter(x => x.booking_id !== b.booking_id))
                        )}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: '#fde8e3', color: '#c0402c', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
              {pending.length > 3 && (
                <p style={{ fontSize: 11, color: '#9aa5b4', textAlign: 'center', margin: 0 }}>+{pending.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
