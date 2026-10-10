// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// The sheets of paper a person can lay on the floor as a known size.

export type Reference = {
  id: string;
  label: string;
  /** Sides in millimetres. `long` is the longer one. */
  long: number;
  short: number;
};

export const REFERENCES: readonly Reference[] = [
  { id: "letter", label: "US Letter", long: 279.4, short: 215.9 }, // 8.5 x 11 in
  { id: "a4", label: "A4", long: 297, short: 210 },
];

export const referenceById = (id: string): Reference =>
  REFERENCES.find((r) => r.id === id) ?? REFERENCES[0];
