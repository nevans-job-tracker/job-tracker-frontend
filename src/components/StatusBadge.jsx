// The single source of truth for how a status is spelled to a human. The
// stored enum values stay lowercase (`phone_screen`) — §3 names them in the API
// contract — so display capitalisation lives here and nowhere else.
//
// Declaration order is the order the dropdowns offer, which is why
// `interested` leads: it is where the lifecycle starts. The database disagrees
// deliberately — MariaDB stores an ENUM as its ordinal, so `interested` had to
// be appended there rather than inserted. See the KAN-31 revision.
export const STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

export const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
