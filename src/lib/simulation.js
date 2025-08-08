// src/lib/simulation.js
import { DateTime } from 'luxon';

// Returns progress from 0 to 1 (clamped)
export function flightProgressPercent(departureISO, arrivalISO, nowISO) {
  const dep = DateTime.fromISO(departureISO, { zone: 'utc' });
  const arr = DateTime.fromISO(arrivalISO, { zone: 'utc' });
  const now = nowISO ? DateTime.fromISO(nowISO, { zone: 'utc' }) : DateTime.utc();
  const dur = arr.toMillis() - dep.toMillis();
  const elapsed = Math.max(0, Math.min(now.toMillis() - dep.toMillis(), dur));
  return dur <= 0 ? 0 : elapsed / dur;
}
