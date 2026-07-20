/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trackpoint } from '../types.js';

interface ActivityChartsProps {
  trackpoints: Trackpoint[];
  distanceKm: number;
  mapHeight?: number;
  compact?: boolean;
}

// --- Leaflet Map Component ---
const LeafletMap: React.FC<{ trackpoints: Trackpoint[] }> = ({ trackpoints }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const coordPoints = useMemo(
    () => trackpoints.filter(tp => tp.latitude !== undefined && tp.longitude !== undefined),
    [trackpoints]
  );

  useEffect(() => {
    if (!mapContainerRef.current || coordPoints.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    import('leaflet').then(L => {
      const latLngs: [number, number][] = coordPoints.map(tp => [tp.latitude!, tp.longitude!]);

      const map = L.map(mapContainerRef.current!, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
      });

      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      const polyline = L.polyline(latLngs, {
        color: '#a3e635',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      // Start Marker
      L.circleMarker(latLngs[0], {
        radius: 7,
        fillColor: '#22c55e',
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(map).bindTooltip('Start', { permanent: false });

      // End Marker
      L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 7,
        fillColor: '#ef4444',
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(map).bindTooltip('Fine', { permanent: false });

      map.fitBounds(polyline.getBounds(), { padding: [32, 32] });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordPoints]);

  if (coordPoints.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs italic">
        Nessun dato GPS disponibile.
      </div>
    );
  }

  return <div ref={mapContainerRef} className="w-full h-full" />;
};

// --- Custom Tooltip Styles ---
const ChartTooltipStyle = {
  contentStyle: {
    background: '#0a0a0a',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    fontSize: '11px',
    color: '#e4e4e7',
  },
  itemStyle: { color: '#e4e4e7' },
  labelStyle: { color: '#52525b', fontSize: '10px' },
};

// --- Main Charts Component ---
export default function ActivityCharts({ trackpoints, distanceKm, mapHeight = 380, compact = false }: ActivityChartsProps) {
  const downsample = (arr: Trackpoint[], maxPts: number) => {
    if (arr.length <= maxPts) return arr;
    const step = Math.ceil(arr.length / maxPts);
    return arr.filter((_, i) => i % step === 0);
  };

  const sampled = useMemo(() => downsample(trackpoints, 400), [trackpoints]);

  const chartData = useMemo(() => {
    return sampled.map((tp, idx) => {
      const distKm = tp.distanceMeters !== undefined
        ? parseFloat((tp.distanceMeters / 1000).toFixed(2))
        : parseFloat(((idx / (sampled.length - 1)) * distanceKm).toFixed(2));

      let paceDecimal: number | undefined;
      if (tp.speedKmh && tp.speedKmh >= 2.0) {
        const raw = 60 / tp.speedKmh;
        paceDecimal = raw <= 20 ? parseFloat(raw.toFixed(2)) : undefined;
      }

      return {
        dist: distKm,
        altitude: tp.altitudeMeters !== undefined ? parseFloat(tp.altitudeMeters.toFixed(1)) : undefined,
        hr: tp.heartRate,
        pace: paceDecimal,
        speedKmh: tp.speedKmh !== undefined ? parseFloat(tp.speedKmh.toFixed(1)) : undefined,
        cadence: tp.cadence ?? undefined,
      };
    });
  }, [sampled, distanceKm]);

  const hasAlt = chartData.some(d => d.altitude !== undefined);
  const hasHr = chartData.some(d => d.hr !== undefined);
  const hasPace = chartData.some(d => d.pace !== undefined);
  const hasCadence = chartData.some(d => d.cadence !== undefined);
  const hasGps = trackpoints.some(tp => tp.latitude !== undefined);

  const paceFormatter = (val: number) => {
    if (!val) return '';
    const min = Math.floor(val);
    const sec = Math.round((val - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const distFormatter = (val: number) => `${val.toFixed(1)}km`;

  const CadenceDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;
    const cad = payload.cadence;
    if (cad === undefined) return null;

    let fill = '#a3e635';
    if (cad < 155) fill = '#ef4444';
    else if (cad < 170) fill = '#f97316';
    else if (cad < 185) fill = '#a3e635';
    else fill = '#06b6d4';

    return <circle cx={cx} cy={cy} r={2.5} fill={fill} stroke="none" />;
  };

  const chartHeight = compact ? 140 : 220;

  return (
    <div className="space-y-0">
      {/* GPS Map — bare, no wrapper card */}
      {hasGps && (
        <div style={{ height: mapHeight }} className="w-full overflow-hidden">
          <LeafletMap trackpoints={trackpoints} />
        </div>
      )}

      {!compact && (
        <div className="space-y-6">
          {/* Altitude + Pace chart */}
          {hasAlt && (
            <div className="clean-panel p-4 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between px-1 mb-4">
                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest font-bold">Altitudine & Passo</span>
                <div className="flex items-center gap-4 text-[9px] font-mono font-semibold">
                  <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-0.5 bg-white/35 dark:bg-white/30 inline-block" /> Alt</span>
                  {hasPace && <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Passo</span>}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dist" tickFormatter={distFormatter} tick={{ fontSize: 9, fill: '#3f3f46' }} stroke="none" tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 5))} />
                  <YAxis yAxisId="alt" tick={{ fontSize: 9, fill: '#52525b' }} stroke="none" tickLine={false} axisLine={false} unit="m" width={36} />
                  {hasPace && <YAxis yAxisId="pace" orientation="right" reversed tick={{ fontSize: 9, fill: '#22d3ee' }} stroke="none" tickLine={false} axisLine={false} tickFormatter={paceFormatter} domain={['auto', 'auto']} width={44} />}
                  <Tooltip {...ChartTooltipStyle} formatter={(val: any, name: string) => {
                    if (name === 'Altitudine') return [`${val} m`, name];
                    if (name === 'Passo') return [paceFormatter(val) + ' /km', name];
                    return [val, name];
                  }} labelFormatter={distFormatter} />
                  <Area yAxisId="alt" type="monotone" dataKey="altitude" name="Altitudine" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} fill="url(#altGrad)" dot={false} connectNulls opacity={0.8} />
                  {hasPace && <Line yAxisId="pace" type="monotone" dataKey="pace" name="Passo" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pace + HR chart */}
          {(hasPace || hasHr) && (
            <div className="clean-panel p-4 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between px-1 mb-4">
                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest font-bold">Passo & Frequenza Cardiaca</span>
                <div className="flex items-center gap-4 text-[9px] font-mono font-semibold">
                  {hasPace && <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Passo</span>}
                  {hasHr && <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2 h-0.5 bg-rose-400 inline-block" /> BPM</span>}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <XAxis dataKey="dist" tickFormatter={distFormatter} tick={{ fontSize: 9, fill: '#3f3f46' }} stroke="none" tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 5))} />
                  <YAxis yAxisId="pace" reversed tick={{ fontSize: 9, fill: '#22d3ee' }} stroke="none" tickLine={false} axisLine={false} tickFormatter={paceFormatter} domain={['auto', 'auto']} width={44} />
                  <YAxis yAxisId="hr" orientation="right" tick={{ fontSize: 9, fill: '#f43f5e' }} stroke="none" tickLine={false} axisLine={false} unit=" bpm" domain={['auto', 'auto']} width={40} />
                  <Tooltip {...ChartTooltipStyle} formatter={(val: any, name: string) => {
                    if (name === 'Passo') return [paceFormatter(val) + ' /km', name];
                    if (name === 'FC') return [`${val} bpm`, name];
                    return [val, name];
                  }} labelFormatter={distFormatter} />
                  {hasPace && <Line yAxisId="pace" type="monotone" dataKey="pace" name="Passo" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls />}
                  {hasHr && <Line yAxisId="hr" type="monotone" dataKey="hr" name="FC" stroke="#f43f5e" strokeWidth={1.5} dot={false} connectNulls />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Cadence chart */}
          {hasCadence && (
            <div className="clean-panel p-4 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between px-1 mb-4">
                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest font-bold">Cadenza</span>
                <div className="flex flex-wrap items-center gap-3 text-[8px] font-mono font-semibold">
                  <span className="flex items-center gap-1 text-rose-500"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> &lt;155</span>
                  <span className="flex items-center gap-1 text-orange-400"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> &lt;170</span>
                  <span className="flex items-center gap-1 text-lime-400"><span className="w-1.5 h-1.5 rounded-full bg-lime-400 inline-block" /> &lt;185</span>
                  <span className="flex items-center gap-1 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" /> ≥185</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <XAxis dataKey="dist" tickFormatter={distFormatter} tick={{ fontSize: 9, fill: '#3f3f46' }} stroke="none" tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 5))} />
                  <YAxis yAxisId="cad" tick={{ fontSize: 9, fill: '#52525b' }} stroke="none" tickLine={false} axisLine={false} unit=" spm" domain={['auto', 'auto']} width={44} />
                  <Tooltip {...ChartTooltipStyle} formatter={(val: any) => [`${val} ppm`, 'Cadenza']} labelFormatter={distFormatter} />
                  <Scatter yAxisId="cad" dataKey="cadence" name="Cadenza" line={false} shape={<CadenceDot />} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
