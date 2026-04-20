import { useLocation, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Booking, Resource } from '../types';
import { useCountdown } from '../hooks/useCountdown';

export function BookingConfirmation() {
  const location = useLocation();
  const booking = location.state?.booking as Booking | undefined;
  const resource = location.state?.resource as Resource | undefined;

  if (!booking) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-gray-500">No booking data found.</p>
        <Link to="/" className="text-brand-600 underline mt-4 inline-block">Back to search</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900">Booking Confirmed!</h1>
        <p className="text-gray-500 mt-2">Your QR code is ready for check-in</p>
      </div>

      {/* Booking details */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
        <div className="bg-brand-600 text-white px-5 py-4">
          <p className="font-bold text-lg">{resource?.name ?? 'Resource'}</p>
          <p className="text-brand-100 text-sm">{resource?.location ?? ''}</p>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {booking.slot_start && (
            <InfoRow
              label="Time"
              value={`${fmt(booking.slot_start)} – ${fmt(booking.slot_end)}`}
            />
          )}
          <InfoRow label="Booking ID" value={booking.booking_id.slice(0, 8).toUpperCase()} />
          <InfoRow label="Status" value={booking.state} />
          {booking.notes && <InfoRow label="Notes" value={booking.notes} />}
        </div>
      </div>

      {booking.expires_at && <CheckInTimer expiresAt={booking.expires_at} />}

      {/* QR Code */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center mb-6">
        <p className="text-sm font-medium text-gray-700 mb-4">Scan at the venue to check in</p>
        <div className="flex justify-center">
          <QRCodeSVG
            value={booking.qr_token}
            size={220}
            level="M"
            marginSize={4}
            bgColor="#ffffff"
            fgColor="#1d4ed8"
          />
        </div>
        <p className="text-xs text-gray-400 mt-3 font-mono break-all">
          {booking.qr_token.slice(0, 24)}…
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          to="/dashboard"
          className="flex-1 text-center border border-gray-300 text-gray-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
        >
          My Bookings
        </Link>
        <Link
          to="/"
          className="flex-1 text-center bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          Book Another
        </Link>
      </div>
    </div>
  );
}

function CheckInTimer({ expiresAt }: { expiresAt: string }) {
  const { minutes, seconds, expired } = useCountdown(expiresAt);

  if (expired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-center">
        <p className="font-bold text-red-700">⚠️ Check-in window expired</p>
        <p className="text-red-600 text-sm mt-1">This booking has been released.</p>
      </div>
    );
  }

  const urgent = minutes < 5;
  return (
    <div className={`rounded-xl px-5 py-4 mb-6 text-center border ${urgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <p className={`text-sm font-medium ${urgent ? 'text-red-700' : 'text-amber-800'}`}>⏱ Check in within</p>
      <p className={`text-4xl font-bold font-mono mt-1 ${urgent ? 'text-red-700' : 'text-amber-700'}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
      <p className={`text-xs mt-1 ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
        Deadline: {new Date(/[Z+]/.test(expiresAt) ? expiresAt : expiresAt + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
