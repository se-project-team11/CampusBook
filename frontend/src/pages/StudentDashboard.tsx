import { useEffect, useState } from 'react';
import type { Booking } from '../types';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';
import { ActiveBookingCard } from '../components/ActiveBookingCard';
import { Badge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';

export function StudentDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingsRes, resourcesRes] = await Promise.all([
        apiClient.bookings.myBookings(),
        apiClient.resources.search(),
      ]);
      setBookings(bookingsRes.data.bookings);
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
  const history = bookings.filter(b => !['CONFIRMED', 'CHECKED_IN'].includes(b.state));

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <Link
          to="/"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + New Booking
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {/* Active */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No active bookings.</p>
            <Link to="/" className="text-brand-600 text-sm mt-2 inline-block">Find a resource →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(b => (
              <ActiveBookingCard key={b.booking_id} booking={b} resourceName={resourceNames[b.resource_id]} onCancelled={load} />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          History ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm">No booking history.</p>
        ) : (
          <div className="space-y-2">
            {history.map(b => <HistoryRow key={b.booking_id} booking={b} resourceName={resourceNames[b.resource_id]} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryRow({ booking, resourceName }: { booking: Booking; resourceName?: string }) {
  const s = new Date(booking.slot_start);
  const e = new Date(booking.slot_end);
  const date = s.toLocaleDateString([], { day: 'numeric', month: 'short', weekday: 'short' });
  const t1 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const t2 = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div>
        {resourceName && <p className="text-sm font-semibold text-gray-900">{resourceName}</p>}
        <p className={`text-sm ${resourceName ? 'text-gray-500' : 'font-medium text-gray-900'}`}>{t1} – {t2}</p>
        <p className="text-xs text-gray-400 mt-0.5">{date}</p>
      </div>
      <Badge label={booking.state} />
    </div>
  );
}
