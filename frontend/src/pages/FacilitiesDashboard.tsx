import { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import { Spinner } from '../components/ui/Spinner';

interface ResourceStat {
  resource_id: string;
  resource_name: string;
  total: number;
  no_show: number;
  confirmed: number;
  checked_in: number;
  no_show_rate: number;
}

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 14 }, (_, i) => `${i + 8}:00`);

function cellColor(count: number, peak: number): string {
  if (peak === 0 || count === 0) return 'bg-gray-100 text-gray-300';
  const ratio = count / peak;
  if (ratio > 0.75) return 'bg-indigo-600 text-white';
  if (ratio > 0.5)  return 'bg-indigo-400 text-white';
  if (ratio > 0.25) return 'bg-indigo-200 text-indigo-700';
  return 'bg-indigo-50 text-indigo-400';
}

function legendColor(level: string): string {
  switch (level) {
    case 'none':   return 'bg-gray-100';
    case 'low':    return 'bg-indigo-50 border border-indigo-200';
    case 'medium': return 'bg-indigo-200';
    case 'high':   return 'bg-indigo-400';
    case 'peak':   return 'bg-indigo-600';
    default:       return '';
  }
}

export function FacilitiesDashboard() {
  const [stats, setStats]       = useState<ResourceStat[]>([]);
  const [cells, setCells]       = useState<number[][]>([]);
  const [peak, setPeak]         = useState(1);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.analytics.utilization(),
      apiClient.analytics.heatmap(),
    ])
      .then(([utilRes, heatRes]) => {
        setStats(utilRes.data.resources as ResourceStat[]);
        setCells(heatRes.data.cells);
        setPeak(Math.max(heatRes.data.peak, 1));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalBookings = stats.reduce((s, r) => s + r.total, 0);
  const totalNoShows  = stats.reduce((s, r) => s + r.no_show, 0);
  const noShowRate    = totalBookings > 0
    ? ((totalNoShows / totalBookings) * 100).toFixed(1)
    : '0.0';
  const totalActive   = stats.reduce((s, r) => s + r.confirmed + r.checked_in, 0);
  const avgUtil       = totalBookings > 0
    ? Math.round((totalActive / totalBookings) * 100)
    : 0;

  if (loading) {
    return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Facilities Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Booking activity across all campus resources — last 7 days</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard
          label="Total Bookings"
          sublabel="last 7 days"
          value={String(totalBookings)}
          color="indigo"
        />
        <StatCard
          label="No-Show Rate"
          sublabel={`${totalNoShows} no-shows`}
          value={`${noShowRate}%`}
          color={parseFloat(noShowRate) > 20 ? 'red' : 'gray'}
        />
        <StatCard
          label="Confirmed Rate"
          sublabel="confirmed + checked-in"
          value={`${avgUtil}%`}
          color="green"
        />
      </div>

      {/* Heatmap */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Booking Density Heatmap</h2>
            <p className="text-xs text-gray-400 mt-0.5">All-time bookings by day &amp; hour — darker = more bookings</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {(['none', 'low', 'medium', 'high', 'peak'] as const).map(level => (
              <span key={level} className="flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded ${legendColor(level)}`} />
                {level === 'none' ? '0' : level === 'low' ? '≤25%' : level === 'medium' ? '≤50%' : level === 'high' ? '≤75%' : '>75%'}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: 640 }}>
            {/* Hour labels */}
            <div className="flex items-center mb-2 pl-12">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-xs text-gray-400 font-medium">
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {DAYS.map((day, d) => (
              <div key={day} className="flex items-center mb-1.5">
                <div className="w-12 text-xs font-semibold text-gray-500 shrink-0">{day}</div>
                {HOURS.map((_, h) => {
                  const count = cells[d]?.[h] ?? 0;
                  const cls   = cellColor(count, peak);
                  return (
                    <div
                      key={h}
                      title={count === 0 ? 'No bookings' : `${count} booking${count !== 1 ? 's' : ''}`}
                      className={`flex-1 h-9 mx-0.5 rounded-md flex items-center justify-center text-xs font-semibold transition-all cursor-default ${cls}`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-resource table */}
      {stats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Per-Resource Breakdown</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Resource</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Active</th>
                <th className="px-4 py-3 text-right">No-Shows</th>
                <th className="px-4 py-3 text-right">No-Show %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats
                .slice()
                .sort((a, b) => b.total - a.total)
                .map(r => {
                  const active = r.confirmed + r.checked_in;
                  const highNoShow = r.no_show_rate > 20;
                  return (
                    <tr key={r.resource_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{r.resource_name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.total}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{active}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.no_show > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {r.no_show}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          highNoShow
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.no_show_rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {stats.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No booking data for the last 7 days.
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, sublabel, value, color,
}: {
  label: string;
  sublabel: string;
  value: string;
  color: 'indigo' | 'green' | 'red' | 'gray';
}) {
  const styles = {
    indigo: 'border-indigo-200 bg-indigo-50',
    green:  'border-green-200 bg-green-50',
    red:    'border-red-200 bg-red-50',
    gray:   'border-gray-200 bg-white',
  };
  const textStyles = {
    indigo: 'text-indigo-900',
    green:  'text-green-900',
    red:    'text-red-900',
    gray:   'text-gray-900',
  };
  return (
    <div className={`rounded-xl border p-5 ${styles[color]}`}>
      <p className={`text-sm font-medium ${textStyles[color]} opacity-70`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textStyles[color]}`}>{value}</p>
      <p className={`text-xs mt-1 ${textStyles[color]} opacity-50`}>{sublabel}</p>
    </div>
  );
}
