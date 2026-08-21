// The single source of truth for how a status is spelled to a human. The
// stored enum values stay lowercase (`phone_screen`) — §3 names them in the API
// contract — so display capitalisation lives here and nowhere else.
export const STATUS_LABELS = {
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
