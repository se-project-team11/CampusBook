import { useState, useEffect } from 'react';
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

  const isPendingApproval = booking.state === 'RESERVED';

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        {isPendingApproval ? (
          <>
            <div className="text-5xl mb-3">⏳</div>
            <h1 className="text-3xl font-bold text-gray-900">Awaiting Approval</h1>
            <p className="text-gray-500 mt-2">
              Your request has been submitted and is pending dept-admin sign-off.
              You will be able to check in once it's approved.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="text-3xl font-bold text-gray-900">Booking Confirmed!</h1>
            <p className="text-gray-500 mt-2">Your QR code is ready for check-in</p>
          </>
        )}
      </div>

      {/* Booking details */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
        <div className={`${isPendingApproval ? 'bg-amber-500' : 'bg-brand-600'} text-white px-5 py-4`}>
          <p className="font-bold text-lg">{resource?.name ?? 'Resource'}</p>
          <p className="text-white/80 text-sm">{resource?.location ?? ''}</p>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {booking.slot_start && (
            <InfoRow
              label="Time"
              value={`${fmt(booking.slot_start)} – ${fmt(booking.slot_end)}`}
            />
          )}
          <InfoRow label="Status" value={booking.state} />
          {booking.notes && <InfoRow label="Notes" value={booking.notes} />}
        </div>
      </div>

      {/* Pending approval notice — no QR until approved */}
      {isPendingApproval ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-center">
          <p className="font-semibold text-amber-800">Approval required</p>
          <p className="text-amber-700 text-sm mt-1">
            A dept admin must approve this booking. Check back in <strong>My Bookings</strong> —
            once approved you'll see your QR code there.
          </p>
        </div>
      ) : (
        <>
          {booking.slot_start && <CheckInTimer slotStart={booking.slot_start} slotEnd={booking.slot_end} />}
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
          </div>
        </>
      )}

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

function CheckInTimer({ slotStart, slotEnd }: { slotStart: string; slotEnd: string }) {
  const slotMs      = new Date(slotStart).getTime();
  const slotEndMs   = new Date(slotEnd).getTime();
  const windowStart = slotMs - 5 * 60_000;
  const windowEnd   = slotMs + 5 * 60_000;
  const windowEndIso = new Date(windowEnd).toISOString();

  const { minutes, seconds, expired } = useCountdown(windowEndIso);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isOngoing = now >= slotMs && now < slotEndMs;

  // Ongoing slot — no timer, no expiry. User can check in anytime until they cancel.
  if (isOngoing) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6 text-center">
        <p className="font-semibold text-green-700">Session in progress</p>
        <p className="text-green-600 text-sm mt-1">Scan the QR code to check in anytime.</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-center">
        <p className="font-bold text-red-700">⚠️ Check-in window closed</p>
        <p className="text-red-600 text-sm mt-1">This booking has been released.</p>
      </div>
    );
  }

  if (now < windowStart) {
    const minsUntil = Math.ceil((windowStart - now) / 60_000);
    const opensAt = new Date(windowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6 text-center">
        <p className="text-sm font-medium text-blue-700">⏰ Check-in opens at {opensAt}</p>
        <p className="text-xs text-blue-500 mt-1">
          ~{minsUntil} minute{minsUntil !== 1 ? 's' : ''} from now
        </p>
      </div>
    );
  }

  const urgent = minutes < 2;
  return (
    <div className={`rounded-xl px-5 py-4 mb-6 text-center border ${urgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <p className={`text-sm font-medium ${urgent ? 'text-red-700' : 'text-amber-800'}`}>⏱ Check in now</p>
      <p className={`text-4xl font-bold font-mono mt-1 ${urgent ? 'text-red-700' : 'text-amber-700'}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
      <p className={`text-xs mt-1 ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
        Window closes at {new Date(windowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
