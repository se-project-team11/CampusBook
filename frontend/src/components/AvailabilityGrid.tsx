import { useState, useEffect } from 'react';
import type { AvailabilitySlot, Resource } from '../types';
import { apiClient } from '../services/api';
import { Spinner } from './ui/Spinner';

interface Props {
  resource: Resource;
  onBook: (slot: AvailabilitySlot) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityGrid({ resource, onBook }: Props) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAvailability = async () => {
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
  };

  useEffect(() => { loadAvailability(); }, [resource.id, selectedDate]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-900">Availability</h3>
        <input
          type="date"
          value={selectedDate}
          min={todayStr()}
          onChange={e => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && (
        <p className="text-center text-red-600 text-sm py-4">{error}</p>
      )}

      {!loading && !error && slots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {slots.map((slot) => {
            const available = slot.status === 'AVAILABLE';
            const isPast = new Date(slot.slot_start) < new Date();
            const disabled = !available || isPast;
            return (
              <button
                key={slot.slot_start}
                disabled={disabled}
                onClick={() => !disabled && onBook(slot)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isPast
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : available
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                    : 'bg-red-50 text-red-400 border-red-100 cursor-not-allowed'
                }`}
              >
                <div>{formatTime(slot.slot_start)}</div>
                <div className="text-xs opacity-70">{available && !isPast ? 'Available' : isPast ? 'Past' : 'Booked'}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-200 inline-block"></span>Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-200 inline-block"></span>Booked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-200 inline-block"></span>Past</span>
      </div>
    </div>
  );
}
