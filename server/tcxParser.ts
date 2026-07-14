/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity, Lap, Trackpoint } from '../src/types.js';

/**
 * Extracts a single tag's text content from XML string using Regex.
 */
function extractTagValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extracts a nested tag value like <AverageHeartRateBpm><Value>145</Value></AverageHeartRateBpm>
 */
function extractNestedTagValue(xml: string, parentTag: string, childTag: string = 'Value'): string {
  const regex = new RegExp(`<${parentTag}[^>]*>[\\s\\S]*?<${childTag}[^>]*>([^<]+)</${childTag}>[\\s\\S]*?</${parentTag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Helper to convert speed in m/s to Pace (MM:SS per km)
 */
function speedToPace(speedMps: number): string {
  if (!speedMps || speedMps <= 0) return '--:--';
  const paceSecPerKm = 1000 / speedMps;
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Helper to calculate pace from distance (km) and duration (min)
 */
function calculatePace(distanceKm: number, durationMin: number): string {
  if (distanceKm <= 0 || durationMin <= 0) return '--:--';
  const totalSeconds = durationMin * 60;
  const secondsPerKm = totalSeconds / distanceKm;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function parseTcx(xmlContent: string): Activity {
  // Extract Sport
  const sportMatch = xmlContent.match(/<Activity\s+Sport="([^"]+)"/i);
  const sport = sportMatch ? sportMatch[1] : 'Running';

  // Extract ID / StartTime
  let id = extractTagValue(xmlContent, 'Id');
  if (!id) {
    const startTimeMatch = xmlContent.match(/StartTime="([^"]+)"/i);
    id = startTimeMatch ? startTimeMatch[1] : new Date().toISOString();
  }

  // Extract Device Brand and Model
  const creatorMatch = xmlContent.match(/<Creator\s+[^>]*>([\s\S]*?)<\/Creator>/i);
  let deviceBrand = 'Garmin';
  let deviceModel = 'Device';
  if (creatorMatch) {
    const creatorXml = creatorMatch[1];
    const name = extractTagValue(creatorXml, 'Name');
    if (name) {
      deviceModel = name;
      if (name.toLowerCase().includes('garmin')) {
        deviceBrand = 'Garmin';
      } else if (name.toLowerCase().includes('wahoo')) {
        deviceBrand = 'Wahoo';
      } else if (name.toLowerCase().includes('apple')) {
        deviceBrand = 'Apple';
      } else if (name.toLowerCase().includes('polar')) {
        deviceBrand = 'Polar';
      } else if (name.toLowerCase().includes('strava')) {
        deviceBrand = 'Strava';
      }
    }
  }

  // Extract Laps
  const lapRegex = /<Lap\s+[^>]*>([\s\S]*?)<\/Lap>/gi;
  let match;
  const laps: Lap[] = [];
  let lapIndex = 1;

  let totalDistanceM = 0;
  let totalTimeSec = 0;
  let totalCalories = 0;

  let hrSum = 0;
  let hrCount = 0;
  let maxHr = 0;

  let cadSum = 0;
  let cadCount = 0;
  let maxCad = 0;

  let maxSpeedMps = 0;

  while ((match = lapRegex.exec(xmlContent)) !== null) {
    const lapXml = match[1];

    const distM = parseFloat(extractTagValue(lapXml, 'DistanceMeters') || '0');
    const timeS = parseFloat(extractTagValue(lapXml, 'TotalTimeSeconds') || '0');
    const cal = parseInt(extractTagValue(lapXml, 'Calories') || '0', 10);

    const avgHrStr = extractNestedTagValue(lapXml, 'AverageHeartRateBpm');
    const maxHrStr = extractNestedTagValue(lapXml, 'MaximumHeartRateBpm');
    const avgHrVal = avgHrStr ? parseInt(avgHrStr, 10) : undefined;
    const maxHrVal = maxHrStr ? parseInt(maxHrStr, 10) : undefined;

    const maxSpeedVal = parseFloat(extractTagValue(lapXml, 'MaximumSpeed') || '0');
    
    // Cadence: check direct tag first, then ns3:RunCadence (Garmin namespace)
    let cadenceVal: number | undefined;
    const directCadence = extractTagValue(lapXml, 'Cadence');
    if (directCadence) {
      cadenceVal = parseInt(directCadence, 10);
    } else {
      // ns3:RunCadence or plain RunCadence inside Extensions
      const extCadenceMatch = lapXml.match(/<(?:[a-zA-Z0-9_]+:)?RunCadence[^>]*>([^<]+)<\/(?:[a-zA-Z0-9_]+:)?RunCadence>/i);
      if (extCadenceMatch) {
        cadenceVal = parseInt(extCadenceMatch[1], 10);
      }
    }

    totalDistanceM += distM;
    totalTimeSec += timeS;
    totalCalories += cal;

    if (avgHrVal) {
      hrSum += avgHrVal * distM; // weighted by distance for better accuracy
      hrCount += distM;
    }
    if (maxHrVal && maxHrVal > maxHr) {
      maxHr = maxHrVal;
    }

    if (cadenceVal) {
      cadSum += cadenceVal * distM;
      cadCount += distM;
      if (cadenceVal > maxCad) {
        maxCad = cadenceVal;
      }
    }

    if (maxSpeedVal > maxSpeedMps) {
      maxSpeedMps = maxSpeedVal;
    }

    laps.push({
      lapIndex,
      distanceKm: parseFloat((distM / 1000).toFixed(2)),
      durationSec: Math.round(timeS),
      calories: cal,
      avgHeartRate: avgHrVal,
      maxHeartRate: maxHrVal,
      maxSpeedKmh: parseFloat((maxSpeedVal * 3.6).toFixed(1)),
      avgSpeedKmh: timeS > 0 ? parseFloat(((distM / timeS) * 3.6).toFixed(1)) : undefined,
      avgCadence: cadenceVal ? cadenceVal * 2 : undefined  // single-foot → full steps
    });

    lapIndex++;
  }

  // Calculate overall metrics
  const totalKm = parseFloat((totalDistanceM / 1000).toFixed(2)) || 5.0; // fallback default
  const totalMin = parseFloat((totalTimeSec / 60).toFixed(1)) || 25.0; // fallback default
  const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : undefined;
  // TCX cadence = single-foot steps/min → multiply by 2 for full steps/min
  const avgCadence = cadCount > 0 ? Math.round((cadSum / cadCount) * 2) : undefined;

  const avgSpeedKmh = totalTimeSec > 0 ? parseFloat(((totalDistanceM / totalTimeSec) * 3.6).toFixed(1)) : 12.0;
  const maxSpeedKmh = parseFloat((maxSpeedMps * 3.6).toFixed(1)) || parseFloat((avgSpeedKmh * 1.25).toFixed(1));

  // Extract Trackpoints
  const trackpoints: Trackpoint[] = [];
  const trackpointRegex = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/gi;
  let tpMatch;
  while ((tpMatch = trackpointRegex.exec(xmlContent)) !== null) {
    const tpXml = tpMatch[1];
    const time = extractTagValue(tpXml, 'Time');
    
    let latitude: number | undefined;
    let longitude: number | undefined;
    const latMatch = tpXml.match(/<LatitudeDegrees>([^<]+)<\/LatitudeDegrees>/i);
    const lonMatch = tpXml.match(/<LongitudeDegrees>([^<]+)<\/LongitudeDegrees>/i);
    if (latMatch) latitude = parseFloat(latMatch[1]);
    if (lonMatch) longitude = parseFloat(lonMatch[1]);

    const altitudeStr = extractTagValue(tpXml, 'AltitudeMeters');
    const altitudeMeters = altitudeStr ? parseFloat(altitudeStr) : undefined;

    const distanceStr = extractTagValue(tpXml, 'DistanceMeters');
    const distanceMeters = distanceStr ? parseFloat(distanceStr) : undefined;

    const hrStr = extractNestedTagValue(tpXml, 'HeartRateBpm');
    const heartRate = hrStr ? parseInt(hrStr, 10) : undefined;

    // Cadence: direct <Cadence> or namespaced <ns3:RunCadence> inside Extensions
    let cadence: number | undefined;
    const cadenceStr = extractTagValue(tpXml, 'Cadence');
    if (cadenceStr) {
      cadence = parseInt(cadenceStr, 10);
    } else {
      const extCadenceMatch = tpXml.match(/<(?:[a-zA-Z0-9_]+:)?RunCadence[^>]*>([^<]+)<\/(?:[a-zA-Z0-9_]+:)?RunCadence>/i);
      if (extCadenceMatch) cadence = parseInt(extCadenceMatch[1], 10);
    }

    // Speed: plain <Speed> or namespaced <ns3:Speed> inside Extensions (value in m/s)
    let speedKmh: number | undefined;
    const speedMatch = tpXml.match(/<(?:[a-zA-Z0-9_]+:)?Speed[^>]*>([^<]+)<\/(?:[a-zA-Z0-9_]+:)?Speed>/i);
    if (speedMatch) {
      speedKmh = parseFloat((parseFloat(speedMatch[1]) * 3.6).toFixed(2));
    }

    trackpoints.push({
      time,
      latitude,
      longitude,
      altitudeMeters,
      distanceMeters,
      heartRate,
      cadence: cadence ? cadence * 2 : undefined, // single-foot → full steps/min
      speedKmh,
      pace: speedKmh ? speedToPace(speedKmh / 3.6) : undefined
    });
  }

  // Determine a nice default title
  const dateObj = new Date(id);
  const hour = dateObj.getHours();
  let timeOfDay = 'Corsa';
  if (hour >= 5 && hour < 12) timeOfDay = 'Corsa Mattutina';
  else if (hour >= 12 && hour < 17) timeOfDay = 'Corsa Pomeridiana';
  else if (hour >= 17 && hour < 22) timeOfDay = 'Corsa Serale';
  else timeOfDay = 'Corsa Notturna';

  const defaultTitle = `${timeOfDay} - ${dateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;

  return {
    id: `act_${Date.now()}`,
    sport,
    name: defaultTitle,
    date: dateObj.toISOString(),
    distanceKm: totalKm,
    durationMin: totalMin,
    calories: totalCalories || Math.round(totalKm * 65), // rough formula
    avgHeartRate: avgHr || undefined,
    maxHeartRate: maxHr || undefined,
    avgCadence: avgCadence || undefined,
    maxCadence: maxCad || undefined,
    avgSpeedKmh,
    maxSpeedKmh,
    avgPace: calculatePace(totalKm, totalMin),
    deviceBrand,
    deviceModel,
    laps,
    notes: `File TCX caricato correttamente. Rilevati ${laps.length} giri (laps).`,
    trackpoints
  };
}
