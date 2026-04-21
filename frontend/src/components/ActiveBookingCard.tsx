import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Booking } from '../types';
import { apiClient } from '../services/api';
import { useCountdown } from '../hooks/useCountdown';
import { Badge } from './ui/Badge';

interface Props {
  booking: Booking;
  resourceName?: string;
  onCancelled: () => void;
}

function fmtSlot(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString([], { day: 'numeric', month: 'short', weekday: 'short' });
  const t1 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const t2 = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { date, time: `${t1} – ${t2}` };
}

export function ActiveBookingCard({ booking, resourceName, onCancelled }: Props) {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const slotMs       = new Date(booking.slot_start).getTime();
  const windowEndIso = new Date(slotMs + 5 * 60_000).toISOString();
  const { minutes, seconds, expired, totalMs } = useCountdown(windowEndIso);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const wasLiveRef = useRef(false);
  const didRefreshRef = useRef(false);

  useEffect(() => {
    if (totalMs > 0) wasLiveRef.current = true;
  }, [totalMs]);

  useEffect(() => {
    if (expired && wasLiveRef.current && !didRefreshRef.current) {
      didRefreshRef.current = true;
      onCancelled();
    }
  }, [expired]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiClient.bookings.cancel(booking.booking_id);
      onCancelled();
    } finally {
      setCancelling(false);
      setShowConfirm(false);
    }
  };

  const { date, time } = fmtSlot(booking.slot_start, booking.slot_end);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="min-w-0">
          {resourceName && <p className="font-semibold text-gray-900 text-sm truncate">{resourceName}</p>}
          <p className={`text-sm ${resourceName ? 'text-gray-500' : 'font-semibold text-gray-900'}`}>{time}</p>
          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge label={booking.state} />
          {booking.state === 'CONFIRMED' && now >= slotMs - 5 * 60_000 && !expired && (
            <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          )}
          <button
            onClick={() => navigate('/confirmation', { state: { booking } })}
            className="text-xs bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg font-medium hover:bg-brand-100"
          >
            QR
          </button>
          {booking.state === 'CONFIRMED' && (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700">Cancel this booking?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="text-sm text-gray-600 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
            >
              Keep
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
