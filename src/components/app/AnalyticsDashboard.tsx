'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from 'recharts';
import { LEAD_STAGES } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

interface Overview {
  days: number;
  visits: {
    total: number;
    avgDurationSeconds: number;
    avgEngagement: number;
    withLead: number;
    conversionRate: number;
    series: { date: string; count: number }[];
  };
  leads: { total: number; byStage: Record<string, number> };
  topRooms: { label: string; total_seconds: number; visits_count: number }[];
  topQuestions: { question: string; occurrences: number }[];
}

export function AnalyticsDashboard({ properties }: { properties: { id: string; title: string }[] }) {
  const [propertyId, setPropertyId] = useState('');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ days: String(days) });
    if (propertyId) qs.set('propertyId', propertyId);
    const res = await fetch(`/api/analytics/overview?${qs}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [propertyId, days]);

  useEffect(() => { void load(); }, [load]);

  const kpis = data
    ? [
        { label: 'Visites', value: String(data.visits.total) },
        { label: 'Durée moyenne', value: formatDuration(data.visits.avgDurationSeconds) },
        { label: 'Engagement moyen', value: `${data.visits.avgEngagement}/100` },
        { label: 'Conversion lead', value: `${data.visits.conversionRate}%` },
      ]
    : [];

  const roomsData = (data?.topRooms ?? []).map((r) => ({
    label: r.label,
    minutes: Math.round(Number(r.total_seconds) / 60),
  }));

  return (
    <div>
      {/* Filtres */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
          className="rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm focus:border-brass-deep focus:outline-none">
          <option value="">Tous les biens</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-xl border border-ink/15 bg-white text-sm">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3.5 py-2.5 transition ${days === d ? 'bg-ink text-porcelain' : 'hover:bg-porcelain'}`}>
              {d} j
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <p className="mt-12 text-sm text-stone-mute">Chargement…</p>
      ) : data ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-ink/10 bg-white p-5">
                <p className="font-display text-3xl">{k.value}</p>
                <p className="mt-1 text-sm text-stone-mute">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Courbe de visites */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg">Visites par jour</h2>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.visits.series}>
                    <defs>
                      <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C2A878" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#C2A878" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)}
                      interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" name="Visites" stroke="#8F7547" strokeWidth={2} fill="url(#brass)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pièces les plus regardées */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg">Pièces les plus regardées</h2>
              <div className="mt-4 h-56">
                {roomsData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roomsData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} stroke="#0B0E1410" />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                        label={{ value: 'minutes cumulées', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="minutes" name="Minutes" fill="#C2A878" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="mt-8 text-sm text-stone-mute">Pas encore de données de navigation.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* FAQ */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg">Questions fréquentes des acquéreurs</h2>
              <ul className="mt-4 space-y-2.5">
                {data.topQuestions.map((q, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <span className="leading-relaxed">{q.question}</span>
                    <span className="shrink-0 rounded-full bg-porcelain px-2 py-0.5 font-mono text-xs">×{q.occurrences}</span>
                  </li>
                ))}
                {data.topQuestions.length === 0 && (
                  <li className="text-sm text-stone-mute">Les questions posées à l'IA apparaîtront ici.</li>
                )}
              </ul>
            </div>

            {/* Pipeline */}
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg">Pipeline ({data.leads.total} leads)</h2>
              <ul className="mt-4 space-y-2.5">
                {LEAD_STAGES.map((s) => {
                  const count = data.leads.byStage[s.value] ?? 0;
                  const pct = data.leads.total ? Math.round((count / data.leads.total) * 100) : 0;
                  return (
                    <li key={s.value} className="text-sm">
                      <div className="flex justify-between">
                        <span>{s.label}</span>
                        <span className="font-mono text-xs">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-porcelain">
                        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-12 text-sm text-stone-mute">Impossible de charger les analytics.</p>
      )}
    </div>
  );
}
