import { useEffect, useState } from 'react';
import type { Booking, WaitlistEntry } from '../types';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';
import { ActiveBookingCard } from '../components/ActiveBookingCard';
import { Badge } from '../components/ui/Badge';
import { WaitlistBadge } from '../components/WaitlistBadge';
import { Link } from 'react-router-dom';

export function StudentDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const active   = bookings.filter(b => ['CONFIRMED', 'CHECKED_IN'].includes(b.state));
  const pending  = bookings.filter(b => b.state === 'RESERVED' && b.requires_approval);
  const history  = bookings.filter(b => !['CONFIRMED', 'CHECKED_IN'].includes(b.state) && !(b.state === 'RESERVED' && b.requires_approval));

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

      {/* Pending Approval */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Pending Approval ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(b => (
              <div key={b.booking_id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  {resourceNames[b.resource_id] && (
                    <p className="text-sm font-semibold text-gray-900">{resourceNames[b.resource_id]}</p>
                  )}
                  <p className="text-xs text-amber-700 mt-0.5">
                    {new Date(b.slot_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {new Date(b.slot_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">Waiting for dept-admin approval</p>
                </div>
                <span className="text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-1 rounded-full">
                  RESERVED
                </span>
              </div>
            ))}
          </div>
        </section>
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

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Waitlist ({waitlist.length})
          </h2>
          <div className="space-y-2">
            {waitlist.map(w => (
              <WaitlistRow key={w.waitlist_id} entry={w} resourceName={resourceNames[w.resource_id]} />
            ))}
          </div>
        </section>
      )}

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

function WaitlistRow({ entry, resourceName }: { entry: WaitlistEntry; resourceName?: string }) {
  const s = new Date(entry.slot_start);
  const e = new Date(entry.slot_end);
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
      <WaitlistBadge position={entry.position} />
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
