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
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Trackpoint } from '../types.js';

interface ActivityChartsProps {
  trackpoints: Trackpoint[];
  distanceKm: number;
}

// --- Leaflet Map Component (lazy-loaded to avoid SSR issues) ---
const LeafletMap: React.FC<{ trackpoints: Trackpoint[] }> = ({ trackpoints }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const coordPoints = useMemo(
    () => trackpoints.filter(tp => tp.latitude !== undefined && tp.longitude !== undefined),
    [trackpoints]
  );

  useEffect(() => {
    if (!mapContainerRef.current || coordPoints.length === 0) return;

    // Prevent double-init
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    import('leaflet').then(L => {
      // Fix default icon paths for bundlers

      const latLngs: [number, number][] = coordPoints.map(tp => [tp.latitude!, tp.longitude!]);

      const map = L.map(mapContainerRef.current!, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
      });

      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Draw route polyline
      const polyline = L.polyline(latLngs, {
        color: '#a3e635',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(map);

      // Start Marker
      L.circleMarker(latLngs[0], {
        radius: 8,
        fillColor: '#22c55e',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(map).bindTooltip('Start', { permanent: false });

      // End Marker
      L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 8,
        fillColor: '#ef4444',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(map).bindTooltip('Fine', { permanent: false });

      map.fitBounds(polyline.getBounds(), { padding: [24, 24] });
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
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#e4e4e7',
  },
  itemStyle: { color: '#e4e4e7' },
  labelStyle: { color: '#71717a', fontSize: '10px' },
};

// --- Main Charts Component ---
export default function ActivityCharts({ trackpoints, distanceKm }: ActivityChartsProps) {
  // Downsample to max 400 points for performance
  const downsample = (arr: Trackpoint[], maxPts: number) => {
    if (arr.length <= maxPts) return arr;
    const step = Math.ceil(arr.length / maxPts);
    return arr.filter((_, i) => i % step === 0);
  };

  const sampled = useMemo(() => downsample(trackpoints, 400), [trackpoints]);

  // Build chart data series indexed by distance (km)
  const chartData = useMemo(() => {
    return sampled.map((tp, idx) => {
      const distKm = tp.distanceMeters !== undefined
        ? parseFloat((tp.distanceMeters / 1000).toFixed(2))
        : parseFloat(((idx / (sampled.length - 1)) * distanceKm).toFixed(2));

      // Convert speed (km/h) to pace (min/km as decimal).
      // Filter out speeds below 2 km/h (GPS noise, standing still, pauses).
      // Cap at 20 min/km to avoid chart scale distortion from brief stops.
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
        cadence: tp.cadence ?? undefined, // already doubled in parser
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
    return `${min}:${sec.toString().padStart(2, '0')} /km`;
  };

  const distFormatter = (val: number) => `${val.toFixed(1)} km`;

  // Custom scatter dot shape for cadence false-color rendering
  const CadenceDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;
    const cad = payload.cadence;
    if (cad === undefined) return null;

    let fill = '#a3e635';
    if (cad < 155) {
      fill = '#ef4444'; // Bassa (< 155) - Rosso
    } else if (cad < 170) {
      fill = '#f97316'; // Moderata-Bassa (< 170) - Arancio
    } else if (cad < 185) {
      fill = '#a3e635'; // Ottimale (< 185) - Lime
    } else {
      fill = '#06b6d4'; // Alta (>= 185) - Ciano
    }

    return <circle cx={cx} cy={cy} r={2.5} fill={fill} stroke="none" />;
  };

  return (
    <div className="space-y-6">
      {/* GPS Map */}
      {hasGps && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-lime-400 inline-block"></span>
            Percorso GPS
          </span>
          <div className="w-full h-96 rounded-lg overflow-hidden border border-zinc-800">
            <LeafletMap trackpoints={trackpoints} />
          </div>
          <div className="flex items-center gap-4 text-[9px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Partenza</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Arrivo</span>
          </div>
        </div>
      )}

      {/* Altitude + Pace chart */}
      {hasAlt && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider flex items-center gap-3">
              Profilo Altitudine & Passo
            </span>
            <div className="flex items-center gap-3 text-[9px] font-mono">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2 h-2 rounded bg-white/30"></span> Altitudine
              </span>
              {hasPace && (
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2 h-0.5 bg-cyan-400"></span> Passo
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dist"
                tickFormatter={distFormatter}
                tick={{ fontSize: 9, fill: '#52525b' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                interval={Math.max(1, Math.floor(chartData.length / 5))}
              />
              {/* Altitude axis - left */}
              <YAxis
                yAxisId="alt"
                tick={{ fontSize: 9, fill: '#71717a' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                unit="m"
                width={40}
              />
              {/* Pace axis - right */}
              {hasPace && (
                <YAxis
                  yAxisId="pace"
                  orientation="right"
                  reversed
                  tick={{ fontSize: 9, fill: '#22d3ee' }}
                  stroke="none"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={paceFormatter}
                  domain={['auto', 'auto']}
                  width={52}
                />
              )}
              <Tooltip
                {...ChartTooltipStyle}
                formatter={(val: any, name: string) => {
                  if (name === 'Altitudine') return [`${val} m`, name];
                  if (name === 'Passo') return [paceFormatter(val), name];
                  return [val, name];
                }}
                labelFormatter={distFormatter}
              />
              <Area
                yAxisId="alt"
                type="monotone"
                dataKey="altitude"
                name="Altitudine"
                stroke="#ffffff"
                strokeWidth={1.5}
                fill="url(#altGrad)"
                dot={false}
                connectNulls
                opacity={0.8}
              />
              {hasPace && (
                <Line
                  yAxisId="pace"
                  type="monotone"
                  dataKey="pace"
                  name="Passo"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pace + HR combined chart */}
      {(hasPace || hasHr) && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider flex items-center gap-3">
              Passo & Frequenza Cardiaca
            </span>
            <div className="flex items-center gap-3 text-[9px] font-mono">
              {hasPace && (
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2 h-0.5 bg-cyan-400"></span> Passo
                </span>
              )}
              {hasHr && (
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2 h-0.5 bg-rose-400"></span> FC
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="dist"
                tickFormatter={distFormatter}
                tick={{ fontSize: 9, fill: '#52525b' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                interval={Math.max(1, Math.floor(chartData.length / 5))}
              />
              {/* Pace axis (left) */}
              <YAxis
                yAxisId="pace"
                reversed
                tick={{ fontSize: 9, fill: '#22d3ee' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                tickFormatter={paceFormatter}
                domain={['auto', 'auto']}
                width={52}
              />
              {/* HR axis (right) */}
              <YAxis
                yAxisId="hr"
                orientation="right"
                tick={{ fontSize: 9, fill: '#f43f5e' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                unit=" bpm"
                domain={['auto', 'auto']}
                width={44}
              />
              <Tooltip
                {...ChartTooltipStyle}
                formatter={(val: any, name: string) => {
                  if (name === 'Passo') return [paceFormatter(val), name];
                  if (name === 'FC') return [`${val} bpm`, name];
                  return [val, name];
                }}
                labelFormatter={distFormatter}
              />
              {hasPace && (
                <Line
                  yAxisId="pace"
                  type="monotone"
                  dataKey="pace"
                  name="Passo"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              )}
              {hasHr && (
                <Line
                  yAxisId="hr"
                  type="monotone"
                  dataKey="hr"
                  name="FC"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cadence Scatter Chart */}
      {hasCadence && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">
              Distribuzione Cadenza (ppm)
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[8px] font-mono">
              <span className="flex items-center gap-1 text-rose-500">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span> &lt;155
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span> &lt;170
              </span>
              <span className="flex items-center gap-1 text-lime-400">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 inline-block"></span> &lt;185
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span> &gt;=185
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="dist"
                tickFormatter={distFormatter}
                tick={{ fontSize: 9, fill: '#52525b' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                interval={Math.max(1, Math.floor(chartData.length / 5))}
              />
              <YAxis
                yAxisId="cad"
                tick={{ fontSize: 9, fill: '#71717a' }}
                stroke="none"
                tickLine={false}
                axisLine={false}
                unit=" spm"
                domain={['auto', 'auto']}
                width={52}
              />
              <Tooltip
                {...ChartTooltipStyle}
                formatter={(val: any) => [`${val} ppm`, 'Cadenza']}
                labelFormatter={distFormatter}
              />
              <Scatter
                yAxisId="cad"
                dataKey="cadence"
                name="Cadenza"
                line={false}
                shape={<CadenceDot />}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
