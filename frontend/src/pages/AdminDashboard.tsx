import { useEffect, useRef, useState } from 'react';
import type { ActiveBookingOverview, Booking, Resource } from '../types';
import { apiClient } from '../services/api';
import { Badge, Button, Spinner } from '../components/ui';

type Tab = 'overview' | 'approvals';

const TYPE_ICON: Record<string, string> = {
  STUDY_ROOM: '📚',
  LAB: '🔬',
  SPORTS: '⚽',
  SEMINAR: '🎓',
};

const TYPE_LABEL: Record<string, string> = {
  STUDY_ROOM: 'Study Room',
  LAB: 'Lab',
  SPORTS: 'Sports',
  SEMINAR: 'Seminar Hall',
};

const POLL_INTERVAL_MS = 30_000;

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeBookings, setActiveBookings] = useState<ActiveBookingOverview[]>([]);
  const [pending, setPending] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    return Promise.all([
      apiClient.resources.search(),
      apiClient.admin.roomOverview(),
      apiClient.admin.pendingApprovals(),
    ])
      .then(([resourcesRes, overviewRes, approvalsRes]) => {
        setResources(resourcesRes.data);
        setActiveBookings(overviewRes.data.bookings);
        setPending(approvalsRes.data.bookings);
        setLastUpdated(new Date());
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  const load = () => fetchData(true);

  const refresh = () => {
    // Reset poll timer so it doesn't fire again immediately after a manual refresh
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    fetchData(false);
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Map resource_id → its current booking (if any)
  const bookingByResource = new Map<string, ActiveBookingOverview>();
  for (const b of activeBookings) bookingByResource.set(b.resource_id, b);

  const freeCount = resources.filter(r => !bookingByResource.has(r.id)).length;
  const occupiedCount = resources.length - freeCount;

  // Booked/checked-in rooms first, then free rooms (stable within each group)
  const sortedResources = [...resources].sort((a, b) => {
    const aBooked = bookingByResource.has(a.id) ? 0 : 1;
    const bBooked = bookingByResource.has(b.id) ? 0 : 1;
    return aBooked - bBooked;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Department resource management</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>
          Room Overview
          {!loading && (
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
              tab === 'overview' ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {occupiedCount}/{resources.length}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === 'approvals'} onClick={() => setTab('approvals')}>
          Pending Approvals
          {pending.length > 0 && (
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
              tab === 'approvals' ? 'bg-amber-100 text-amber-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {pending.length}
            </span>
          )}
        </TabBtn>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* ── Room Overview ── */}
      {!loading && tab === 'overview' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Loading…'}
            </p>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors"
            >
              <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard value={resources.length} label="Total Rooms" color="gray" />
            <StatCard value={freeCount} label="Available Now" color="green" />
            <StatCard value={occupiedCount} label="Occupied" color="blue" />
          </div>

          {/* Room cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedResources.map(r => {
              const booking = bookingByResource.get(r.id);
              const isOccupied = !!booking;
              const isCheckedIn = booking?.state === 'CHECKED_IN';

              return (
                <div
                  key={r.id}
                  className={`bg-white rounded-xl border p-4 ${
                    isCheckedIn
                      ? 'border-purple-200'
                      : isOccupied
                      ? 'border-blue-200'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Room header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl flex-shrink-0">{TYPE_ICON[r.type] ?? '🏫'}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.location}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                      <StatusChip occupied={isOccupied} checkedIn={isCheckedIn} />
                    </div>
                  </div>

                  {/* Room meta */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span>👥 {r.capacity} capacity</span>
                    {r.amenities.length > 0 && (
                      <span className="truncate">✓ {r.amenities.join(', ')}</span>
                    )}
                  </div>

                  {/* Booking info */}
                  {isOccupied && booking ? (
                    <div className={`rounded-lg px-3 py-2 text-xs ${
                      isCheckedIn ? 'bg-purple-50 border border-purple-100' : 'bg-blue-50 border border-blue-100'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${isCheckedIn ? 'text-purple-700' : 'text-blue-700'}`}>
                          {fmtTime(booking.slot_start)} – {fmtTime(booking.slot_end)}
                        </span>
                        <span className={`text-xs ${isCheckedIn ? 'text-purple-500' : 'text-blue-500'}`}>
                          {fmtDate(booking.slot_start)}
                        </span>
                      </div>
                      <p className={`mt-1 ${isCheckedIn ? 'text-purple-600' : 'text-blue-600'}`}>
                        {booking.user_email}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg px-3 py-2 text-xs bg-green-50 border border-green-100 text-green-700 font-medium">
                      No upcoming bookings
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Pending Approvals ── */}
      {!loading && tab === 'approvals' && (
        <>
          {pending.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-gray-900">All caught up</p>
              <p className="text-sm text-gray-500 mt-1">No bookings awaiting approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(b => (
                <ApprovalCard
                  key={b.booking_id}
                  booking={b}
                  resourceName={
                    resources.find(r => r.id === b.resource_id)?.name ??
                    `Resource ${b.resource_id.slice(0, 8)}`
                  }
                  onApprove={() =>
                    apiClient.admin.approve(b.booking_id).then(() => {
                      setPending(prev => prev.filter(x => x.booking_id !== b.booking_id));
                      load();
                    })
                  }
                  onReject={() =>
                    apiClient.admin.reject(b.booking_id).then(() =>
                      setPending(prev => prev.filter(x => x.booking_id !== b.booking_id)),
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: 'gray' | 'green' | 'blue' }) {
  const styles = {
    gray:  'bg-gray-50 border-gray-200 text-gray-900',
    green: 'bg-green-50 border-green-200 text-green-800',
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

function StatusChip({ occupied, checkedIn }: { occupied: boolean; checkedIn: boolean }) {
  if (checkedIn) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
        IN USE
      </span>
    );
  }
  if (occupied) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        BOOKED
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      FREE
    </span>
  );
}

function ApprovalCard({
  booking,
  resourceName,
  onApprove,
  onReject,
}: {
  booking: Booking;
  resourceName: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 text-sm">{resourceName}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          #{booking.booking_id.slice(0, 8).toUpperCase()}
          {booking.user_email ? ` · ${booking.user_email}` : ''}
        </p>
        {booking.slot_start && (
          <p className="text-xs text-gray-500 mt-0.5">
            {fmt(booking.slot_start)} — {fmt(booking.slot_end)}
          </p>
        )}
        <div className="mt-2">
          <Badge label={booking.state} color="amber" />
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="secondary" size="sm" onClick={onApprove}>Approve</Button>
        <Button variant="danger" size="sm" onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
