import { useState, useEffect, useCallback } from 'react';
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

export function AvailabilityGrid({ resource, onBook, refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedWaitlist, setJoinedWaitlist] = useState<Set<string>>(new Set());
  const [waitlistLoading, setWaitlistLoading] = useState<string | null>(null);

  const lastEvent = useResourceSocket(resource.id);

  const canBook = user?.role === 'ROLE_STUDENT' || user?.role === 'ROLE_FACULTY';

  const handleJoinWaitlist = async (slot: AvailabilitySlot) => {
    setWaitlistLoading(slot.slot_start);
    try {
      await apiClient.waitlist.join(resource.id, slot.slot_start, slot.slot_end);
      setJoinedWaitlist(prev => new Set(prev).add(slot.slot_start));
    } catch {
      // silently ignore — slot may have opened, user can refresh
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

  useEffect(() => {
    if (!lastEvent) return;
    loadAvailability();
  }, [lastEvent, loadAvailability]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Availability</h3>
          {lastEvent && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full animate-pulse">
              Live
            </span>
          )}
        </div>
        <input
          type="date"
          value={selectedDate}
          min={todayStr()}
          onChange={e => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <p className="text-center text-red-600 text-sm py-4">{error}</p>}

      {!loading && !error && slots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {slots.map((slot) => {
            const available = slot.status === 'AVAILABLE';
            const isPast = new Date(slot.slot_start) < new Date();
            const isBooked = !available && !isPast;
            const alreadyWaitlisted = joinedWaitlist.has(slot.slot_start);
            const isJoining = waitlistLoading === slot.slot_start;

            if (isBooked && canBook) {
              return (
                <div key={slot.slot_start} className="px-3 py-2.5 rounded-xl text-sm border bg-red-50 border-red-100 flex flex-col gap-1">
                  <div className="font-medium text-red-400">{formatTime(slot.slot_start)}</div>
                  <div className="text-xs text-red-400 opacity-70">Booked</div>
                  {slot.waitlist_count && slot.waitlist_count > 0 ? (
                    <div className="text-xs text-amber-600">{slot.waitlist_count} waiting</div>
                  ) : null}
                  <button
                    disabled={alreadyWaitlisted || isJoining}
                    onClick={() => handleJoinWaitlist(slot)}
                    className="mt-0.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                  >
                    {isJoining ? '…' : alreadyWaitlisted ? '✓ Waitlisted' : '+ Waitlist'}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={slot.slot_start}
                disabled={!available || isPast}
                onClick={() => available && !isPast && onBook(slot)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isPast
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : available
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                    : 'bg-red-50 text-red-400 border-red-100 cursor-not-allowed'
                }`}
              >
                <div>{formatTime(slot.slot_start)}</div>
                <div className="text-xs opacity-70">
                  {isPast ? 'Past' : 'Available'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-emerald-200 inline-block" />Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-200 inline-block" />Booked
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />Past
        </span>
      </div>
    </div>
  );
}
