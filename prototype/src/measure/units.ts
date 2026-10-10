// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// Units the app can show. Everything is computed in millimetres.

export type Unit = "cm" | "in";
export const UNITS: readonly Unit[] = ["cm", "in"];

const MM_PER: Record<Unit, number> = { cm: 10, in: 25.4 };

export const fromMm = (mm: number, unit: Unit): number => mm / MM_PER[unit];
export const toMm = (value: number, unit: Unit): number => value * MM_PER[unit];
export const isUnit = (value: unknown): value is Unit =>
  typeof value === "string" && (UNITS as readonly string[]).includes(value);
