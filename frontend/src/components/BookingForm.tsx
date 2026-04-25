import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import type { AvailabilitySlot, Resource } from '../types';
import { apiClient } from '../services/api';
import { Spinner } from './ui/Spinner';
import { Modal } from './ui/Modal';

interface Props {
  resource: Resource;
  slot: AvailabilitySlot;
  onClose: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(start: string, end: string) {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  return mins >= 60 ? `${mins / 60} hr` : `${mins} min`;
}

export function BookingForm({ resource, slot, onClose }: Props) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    apiClient.bookings.myBookings()
      .then(res => {
        const count = res.data.bookings.filter(
          b => ['CONFIRMED', 'CHECKED_IN'].includes(b.state),
        ).length;
        setActiveCount(count);
      })
      .catch(() => setActiveCount(0)); // fail open — don't block booking on fetch error
  }, []);

  const atLimit = activeCount !== null && activeCount >= 3;

  const handleBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.bookings.create(
        resource.id, slot.slot_start, slot.slot_end, notes,
      );
      navigate('/confirmation', { state: { booking: res.data, resource } });
      onClose();
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message: string }; detail?: string }>;
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.error?.message ?? axiosErr.response?.data?.detail ?? '';

      if (status === 403) {
        setError(detail || 'You do not have permission to book this resource type.');
      } else if (status === 409) {
        setError(
          detail.toLowerCase().includes('concurrent')
            ? 'Booking conflict detected. Please try again.'
            : 'This slot was just taken. Please pick another time.',
        );
      } else if (status === 422) {
        setError(detail || 'Validation failed.');
      } else if (!axiosErr.response) {
        setError('Connection error. Check your network.');
      } else {
        setError('Booking failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="bg-brand-600 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Confirm Booking</h2>
        <p className="text-brand-100 text-sm mt-0.5">{resource.name}</p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <Row label="Resource" value={resource.name} />
          <Row label="Type" value={resource.type.replace('_', ' ')} />
          <Row label="Location" value={resource.location} />
          <Row label="From" value={formatDateTime(slot.slot_start)} />
          <Row label="To" value={formatDateTime(slot.slot_end)} />
          <Row label="Duration" value={formatDuration(slot.slot_start, slot.slot_end)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Purpose of booking, group size, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          ⏱ You must scan your QR code within <strong>5 minutes</strong> of your slot start or it will be released.
        </div>

        {atLimit && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
            <strong>Booking limit reached.</strong> You already have 3 active bookings. Cancel one before making a new booking.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="px-6 pb-5 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleBook}
          disabled={loading || atLimit}
          className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Spinner size="sm" color="white" />}
          {loading ? 'Booking…' : 'Confirm Booking'}
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
