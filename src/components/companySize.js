// Wellfound's bands, adopted rather than invented so the values match what the
// postings already say. See REQUIREMENTS.md §2 for the trade-off — these are
// their taxonomy, not ours.
//
// The labels carry the employee ranges because the band names alone are
// ambiguous: "Large" means nothing without "201–500", and choosing correctly is
// the entire point of a controlled list.
//
// Same shape as STATUS_LABELS in StatusBadge.jsx, and for the same reason —
// one map, used everywhere a company size is spelled for a human, so KAN-34's
// cleanup never has to happen twice. If a third of these appears, they belong
// together in one module.
export const COMPANY_SIZE_LABELS = {
  seed: "Seed (1–10 employees)",
  early: "Early (11–50 employees)",
  mid_size: "Mid-size (51–200 employees)",
  large: "Large (201–500 employees)",
  very_large: "Very Large (501–1000 employees)",
  massive: "Massive (1001+ employees)",
};

// Declaration order is smallest to largest, matching the enum on the backend.
// That order is what makes sorting by this column mean band order.
export const COMPANY_SIZE_OPTIONS = Object.keys(COMPANY_SIZE_LABELS);
