/**
 * Every map that spells a stored enum value for a human.
 *
 * One module by instruction rather than by taste: KAN-34 removed three
 * duplicate status formatters, and the note left on COMPANY_SIZE_LABELS said
 * that once a third such map appeared they belonged together. KAN-50 and
 * KAN-51 made five.
 *
 * Why it matters that they are here and not beside the component that first
 * needed them: these are the *only* place a value is spelled, and the CSV
 * export reads them as much as the UI does. Scattered, nothing announced that
 * property, and the next enum had no obvious home for its labels.
 *
 * Declaration order is load-bearing in every map below, but for two different
 * reasons — worth reading them next to each other:
 *
 *   - STATUS_LABELS orders for the *dropdown*, and deliberately disagrees with
 *     the database.
 *   - The other three match their backend enum's declaration order, which is
 *     what makes sorting by those columns mean anything on MariaDB.
 */

// Stored values stay lowercase (`phone_screen`) — §3 names them in the API
// contract — so display capitalisation lives here and nowhere else.
//
// `interested` leads because it is where the lifecycle starts. The database
// disagrees deliberately: MariaDB stores an ENUM as its ordinal, so it had to
// be *appended* there rather than inserted. See the KAN-31 revision.
export const STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
  // The terminal states read in order of who ended it: they decided (rejected),
  // they went quiet (ghosted), circumstance (posting closed), you decided
  // (withdrawn). The database appends this one — see the KAN-57 revision.
  posting_closed: "Posting Closed",
  withdrawn: "Withdrawn",
};

export const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

// The lifecycle split the list filters on by default (KAN-62): an application
// is either still in play or it is over.
//
// Subsets of STATUS_LABELS rather than a second ordering — they are listed in
// the order that map already declares, so the dropdown's groups read the way
// the lifecycle runs.
//
// This is the second place the split is written down; models.py has the other.
// The status enum and its order are already duplicated the same way, so this
// is a known cost rather than a new one, but a third copy would be worth
// resisting.
export const ACTIVE_STATUSES = [
  "interested",
  "applied",
  "phone_screen",
  "interview",
  "offer",
];

// The complement, computed for the same reason the backend computes it: a
// status added later cannot end up in neither group. It lands in Inactive,
// which errs towards hiding a row rather than quietly reintroducing clutter.
export const INACTIVE_STATUSES = STATUS_OPTIONS.filter(
  (value) => !ACTIVE_STATUSES.includes(value)
);

// The set options that share the status dropdown with the individual statuses.
//
// Prefixed because one control drives two URL parameters: `set:` says "this is
// a lifecycle set, not a status", so the two can never be confused by a reader
// of the code or by a value arriving from an old bookmark.
export const STATUS_SET_PREFIX = "set:";

// All first, as the broadest option — the same place "All Sources" sits in the
// filter beside it. It also stops the list stuttering: with All in the middle,
// "Active Statuses" was separated from the "Active" group heading below by an
// unrelated option, so the word arrived twice in four rows without the second
// reading as a heading for the first (KAN-65).
//
// The default is still "active". A select shows what is selected rather than
// what is first, so it costs nothing to be second here.
export const STATUS_SET_OPTIONS = [
  ["all", "All Statuses"],
  ["active", "Active Statuses"],
  ["inactive", "Inactive Statuses"],
];

// Wellfound's bands, adopted rather than invented so the values match what the
// postings already say. See REQUIREMENTS.md §2 — these are their taxonomy.
//
// The labels carry the employee ranges because the band names alone are
// ambiguous: "Large" means nothing without "201–500", and choosing correctly is
// the entire point of a controlled list.
//
// Smallest to largest, matching the backend enum. That order is what makes
// sorting by this column mean band order.
export const COMPANY_SIZE_LABELS = {
  seed: "Seed (1–10 employees)",
  early: "Early (11–50 employees)",
  mid_size: "Mid-size (51–200 employees)",
  large: "Large (201–500 employees)",
  very_large: "Very Large (501–1000 employees)",
  massive: "Massive (1001+ employees)",
};

export const COMPANY_SIZE_OPTIONS = Object.keys(COMPANY_SIZE_LABELS);

// What the figures in salary_min/salary_max measure (KAN-50). Two values, and
// the labels say which figure they describe rather than just naming the period
// — "Hourly" beside a pair of amount fields is ambiguous about what is hourly.
export const PAY_PERIOD_LABELS = {
  annual: "Annual salary",
  hourly: "Hourly rate",
};

export const PAY_PERIOD_OPTIONS = Object.keys(PAY_PERIOD_LABELS);

// Most to least conventional commitment, matching the backend enum — MariaDB
// stores an ENUM as its ordinal, so this is what sorting the column means. The
// two contract kinds are adjacent because that is the distinction most often
// being drawn (KAN-51).
export const EMPLOYMENT_TYPE_LABELS = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  contract_to_hire: "Contract-to-Hire",
  volunteer: "Volunteer",
};

export const EMPLOYMENT_TYPE_OPTIONS = Object.keys(EMPLOYMENT_TYPE_LABELS);

// A contract term only means something alongside one of these. The API
// enforces the pairing; this is what the form reads to decide whether to offer
// the field at all.
export const CONTRACT_TYPES = ["contract", "contract_to_hire"];
