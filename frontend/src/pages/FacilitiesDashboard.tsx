import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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
const HOURS = Array.from({ length: 14 }, (_, i) => `${i + 8}h`);

function heatCellStyle(count: number, peak: number): CSSProperties {
  if (peak === 0 || count === 0) return { background: 'rgba(255,255,255,0.12)', color: 'transparent' };
  const ratio = count / peak;
  if (ratio > 0.75) return { background: 'rgba(76,168,176,0.85)', color: 'white' };
  if (ratio > 0.5)  return { background: 'rgba(76,168,176,0.6)',  color: 'white' };
  if (ratio > 0.25) return { background: 'rgba(76,168,176,0.35)', color: '#1a4a52' };
  return { background: 'rgba(255,255,255,0.22)', color: '#2a5a64' };
}

function SemiGauge({ value }: { value: number }) {
  const r = 44, cx = 55, cy = 52;
  const arc = Math.PI * r;
  const offset = arc * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <svg viewBox="0 0 110 60" style={{ width: '100%', maxWidth: 160 }}>
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#d95840" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${arc}`} strokeDashoffset={`${offset}`} />
    </svg>
  );
}

function MiniBarChart({ data }: { data: { value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 44, marginTop: 16 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{
            width: '100%',
            background: '#4ca8b0',
            borderRadius: '3px 3px 0 0',
            height: `${Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0)}%`,
          }} />
        </div>
      ))}
    </div>
  );
}

const card: CSSProperties = { background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' };
const cardLabel: CSSProperties = { fontSize: 13, fontWeight: 500, color: '#6b7a8d', margin: 0 };
const bigNum: CSSProperties = { fontSize: 48, fontWeight: 700, color: '#1a2535', lineHeight: 1.1, margin: '8px 0 4px' };
const cardSub: CSSProperties = { fontSize: 12, color: '#9aa5b4', margin: 0 };
const iconBox: CSSProperties = { width: 32, height: 32, background: '#f0f9fb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

export function FacilitiesDashboard() {
  const [stats, setStats] = useState<ResourceStat[]>([]);
  const [cells, setCells] = useState<number[][]>([]);
  const [peak,  setPeak]  = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.analytics.utilization(), apiClient.analytics.heatmap()])
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
  const noShowRate    = totalBookings > 0 ? ((totalNoShows / totalBookings) * 100).toFixed(1) : '0.0';
  const totalActive   = stats.reduce((s, r) => s + r.confirmed + r.checked_in, 0);
  const avgUtil       = totalBookings > 0 ? Math.round((totalActive / totalBookings) * 100) : 0;
  const sortedStats   = stats.slice().sort((a, b) => b.total - a.total);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spinner size="lg" /></div>;
  }

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2535', margin: 0 }}>Facilities Analytics</h1>
        <p style={{ fontSize: 13, color: '#6b7a8d', margin: '4px 0 0' }}>Booking activity across all campus resources</p>
      </div>

      {/* Top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 20 }}>

        {/* Heatmap hero card */}
        <div style={{ background: 'linear-gradient(135deg, #a8c5da, #c5dce8)', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1e3a4a', margin: '0 0 2px' }}>Booking Density</p>
          <p style={{ fontSize: 12, color: '#4a6a7a', margin: '0 0 16px' }}>All-time bookings by day and hour</p>

          <div style={{ overflowX: 'auto' }}>
            {/* Hour labels */}
            <div style={{ display: 'flex', paddingLeft: 38, marginBottom: 5 }}>
              {HOURS.map(h => (
                <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#4a6a7a', fontWeight: 600 }}>{h}</div>
              ))}
            </div>
            {/* Grid rows */}
            {DAYS.map((day, d) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ width: 34, fontSize: 10, fontWeight: 600, color: '#3a5a6a', flexShrink: 0 }}>{day}</div>
                {HOURS.map((_, h) => {
                  const count = cells[d]?.[h] ?? 0;
                  return (
                    <div
                      key={h}
                      title={count === 0 ? 'No bookings' : `${count} booking${count !== 1 ? 's' : ''}`}
                      style={{
                        flex: 1, height: 26, margin: '0 1px', borderRadius: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 600, cursor: 'default',
                        transition: 'opacity 0.2s',
                        ...heatCellStyle(count, peak),
                      }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center' }}>
            {[
              { label: 'None',  bg: 'rgba(255,255,255,0.22)' },
              { label: 'Low',   bg: 'rgba(76,168,176,0.35)' },
              { label: 'Med',   bg: 'rgba(76,168,176,0.6)' },
              { label: 'High',  bg: 'rgba(76,168,176,0.85)' },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#4a6a7a' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* No-show rate stat card */}
        <div style={{ background: '#f5c9b3', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#7a3d2a', margin: 0 }}>No-Show Rate</p>
          <p style={bigNum}>{noShowRate}%</p>
          <p style={{ fontSize: 12, color: '#8a5040', margin: 0 }}>{totalNoShows} no-shows of {totalBookings} total</p>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
            <SemiGauge value={parseFloat(noShowRate)} />
          </div>
          <p style={{ fontSize: 11, fontWeight: 500, color: parseFloat(noShowRate) > 20 ? '#c0402c' : '#5a7040', margin: 0 }}>
            {parseFloat(noShowRate) > 20 ? 'High — consider follow-up' : 'Within acceptable range'}
          </p>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

        {/* Total bookings KPI */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={cardLabel}>Total Bookings</p>
            <div style={iconBox}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ca8b0" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <p style={bigNum}>{totalBookings}</p>
          <p style={cardSub}>all time</p>
          {sortedStats.length > 0 && (
            <MiniBarChart data={sortedStats.slice(0, 6).map(r => ({ value: r.total }))} />
          )}
        </div>

        {/* Per-resource breakdown */}
        <div style={card}>
          <p style={{ ...cardLabel, marginBottom: 16 }}>By Resource</p>
          {sortedStats.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9aa5b4' }}>No data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sortedStats.slice(0, 5).map(r => {
                const pct = totalBookings > 0 ? Math.round((r.total / totalBookings) * 100) : 0;
                return (
                  <div key={r.resource_id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, color: '#1a2535', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                        {r.resource_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#6b7a8d' }}>{r.total}</span>
                        {r.no_show_rate > 20 && (
                          <span style={{ fontSize: 10, background: '#fde8e3', color: '#c0402c', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            {r.no_show_rate}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#f0f2f5', borderRadius: 2 }}>
                      <div style={{ height: 4, width: `${pct}%`, background: '#4ca8b0', borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmed rate KPI */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={cardLabel}>Confirmed Rate</p>
            <div style={iconBox}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ca8b0" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <p style={bigNum}>{avgUtil}%</p>
          <p style={cardSub}>confirmed + checked-in</p>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#6b7a8d' }}>Confirmed</span>
              <span style={{ color: '#1a2535', fontWeight: 500 }}>{stats.reduce((s, r) => s + r.confirmed, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#6b7a8d' }}>Checked-in</span>
              <span style={{ color: '#1a2535', fontWeight: 500 }}>{stats.reduce((s, r) => s + r.checked_in, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#6b7a8d' }}>No-shows</span>
              <span style={{ color: '#c0402c', fontWeight: 500 }}>{totalNoShows}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
