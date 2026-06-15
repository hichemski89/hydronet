import { FlowUnit } from '../types/network';

export const FLOW_UNIT_LABELS: Record<FlowUnit, string> = {
  LPS: 'L/s',
  LPM: 'L/min',
  MLD: 'ML/j',
  CMH: 'm³/h',
  CMD: 'm³/j',
  GPM: 'gal/min',
  CFS: 'ft³/s',
};

export function fmt(value: number | undefined | null, digits = 2): string {
  if (value == null || !isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** Formate une durée en secondes vers "HH:MM". */
export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function flowUnitLabel(units: FlowUnit): string {
  return FLOW_UNIT_LABELS[units];
}
