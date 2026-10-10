// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.

/** A measured number. `error` is one stated uncertainty in the same unit as
 * `value`, and `basis` says in plain words what that error covers and what it
 * leaves out. A number without a basis is not a measurement. */
export type Measured = {
  value: number;
  error: number;
  unit: string;
  basis: string;
};

export const measured = (
  value: number,
  error: number,
  unit: string,
  basis: string,
): Measured => ({ value, error, unit, basis });

/** True when both the value and its error are real numbers. */
export const isMeasured = (m: Measured): boolean =>
  Number.isFinite(m.value) && Number.isFinite(m.error) && m.error >= 0;
