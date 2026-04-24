import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { AvailabilitySlot, Resource } from '../types';
import { apiClient } from '../services/api';
import { useResourceSocket } from '../hooks/useResourceSocket';
import { Spinner } from './ui/Spinner';
import { useAuth } from '../context/AuthContext';

interface Props {
  resource: Resource;
  onBook: (slot: AvailabilitySlot) => void;
  refreshKey?: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const card: CSSProperties = { background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' };

export function AvailabilityGrid({ resource, onBook, refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [slots, setSlots]               = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [joinedWaitlist, setJoinedWaitlist]   = useState<Set<string>>(new Set());
  const [waitlistLoading, setWaitlistLoading] = useState<string | null>(null);

  const lastEvent = useResourceSocket(resource.id);
  const canBook   = user?.role === 'ROLE_STUDENT' || user?.role === 'ROLE_FACULTY';

  const handleJoinWaitlist = async (slot: AvailabilitySlot) => {
    setWaitlistLoading(slot.slot_start);
    try {
      await apiClient.waitlist.join(resource.id, slot.slot_start, slot.slot_end);
      setJoinedWaitlist(prev => new Set(prev).add(slot.slot_start));
    } catch {
      // slot may have opened — user can refresh
    } finally {
      setWaitlistLoading(null);
    }
  };

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.resources.availability(resource.id, selectedDate);
      setSlots(res.data.slots);
    } catch {
      setError('Failed to load availability.');
    } finally {
      setLoading(false);
    }
  }, [resource.id, selectedDate]);

  useEffect(() => { loadAvailability(); }, [loadAvailability, refreshKey]);
  useEffect(() => { if (lastEvent) loadAvailability(); }, [lastEvent, loadAvailability]);

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a2535', margin: 0 }}>Availability</h3>
          {lastEvent && (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#267040', background: '#edf7ee', padding: '2px 8px', borderRadius: 20 }}>
              Live
            </span>
          )}
        </div>
        <input
          type="date"
          value={selectedDate}
          min={todayStr()}
          onChange={e => setSelectedDate(e.target.value)}
          style={{
            border: '1px solid #e0e4ea', borderRadius: 10, padding: '7px 12px',
            fontSize: 13, color: '#1a2535', fontFamily: "'DM Sans', system-ui, sans-serif",
            outline: 'none',
          }}
        />
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><Spinner /></div>}
      {error  && <p style={{ textAlign: 'center', color: '#c0402c', fontSize: 13, padding: '12px 0' }}>{error}</p>}

      {!loading && !error && slots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {slots.map(slot => {
            const available        = slot.status === 'AVAILABLE';
            const isPast           = new Date(slot.slot_start) < new Date();
            const isBooked         = !available && !isPast;
            const alreadyWaitlisted = joinedWaitlist.has(slot.slot_start);
            const isJoining        = waitlistLoading === slot.slot_start;

            if (isBooked && canBook) {
              return (
                <div key={slot.slot_start} style={{
                  borderRadius: 14, padding: '12px 10px',
                  background: '#fde8e3', border: '1px solid #f5c6b8',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#c0402c', margin: 0 }}>{formatTime(slot.slot_start)}</p>
                  <p style={{ fontSize: 11, color: '#c0402c', opacity: 0.7, margin: 0 }}>Booked</p>
                  {slot.waitlist_count && slot.waitlist_count > 0 ? (
                    <p style={{ fontSize: 11, color: '#b07020', margin: 0 }}>{slot.waitlist_count} waiting</p>
                  ) : null}
                  <button
                    disabled={alreadyWaitlisted || isJoining}
                    onClick={() => handleJoinWaitlist(slot)}
                    style={{
                      marginTop: 2, fontSize: 11, fontWeight: 600,
                      padding: '4px 8px', borderRadius: 8,
                      background: alreadyWaitlisted ? '#edf7ee' : '#fff3da',
                      color: alreadyWaitlisted ? '#267040' : '#b07020',
                      border: `1px solid ${alreadyWaitlisted ? '#c0e8c8' : '#f0dda0'}`,
                      cursor: alreadyWaitlisted ? 'default' : 'pointer',
                      fontFamily: 'inherit', opacity: isJoining ? 0.6 : 1,
                    }}
                  >
                    {isJoining ? '...' : alreadyWaitlisted ? 'Waitlisted' : '+ Waitlist'}
                  </button>
                </div>
              );
            }

            const slotStyle: CSSProperties = isPast ? {
              borderRadius: 14, padding: '12px 10px', textAlign: 'center',
              background: '#f6f7f9', border: '1px solid #e8ecf0', cursor: 'not-allowed',
            } : available ? {
              borderRadius: 14, padding: '12px 10px', textAlign: 'center',
              background: '#eaf7f5', border: '1.5px solid #b0dde8', cursor: 'pointer',
              transition: 'box-shadow 0.15s',
            } : {
              borderRadius: 14, padding: '12px 10px', textAlign: 'center',
              background: '#fde8e3', border: '1px solid #f5c6b8', cursor: 'not-allowed',
            };

            return (
              <button
                key={slot.slot_start}
                disabled={!available || isPast}
                onClick={() => available && !isPast && onBook(slot)}
                style={{ ...slotStyle, fontFamily: 'inherit', outline: 'none', width: '100%' }}
                onMouseEnter={e => {
                  if (available && !isPast) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(76,168,176,0.2)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: isPast ? '#b0bac6' : available ? '#1e7a88' : '#c0402c' }}>
                  {formatTime(slot.slot_start)}
                </p>
                <p style={{ fontSize: 11, margin: '3px 0 0', color: isPast ? '#c8d0d8' : available ? '#4ca8b0' : '#e47a67' }}>
                  {isPast ? 'Past' : available ? 'Available' : 'Booked'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, marginTop: 18, paddingTop: 14, borderTop: '1px solid #f0f2f5' }}>
        {[
          { label: 'Available', dot: '#4ca8b0' },
          { label: 'Booked',    dot: '#e47a67' },
          { label: 'Past',      dot: '#c8d0d8' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7a8d' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
