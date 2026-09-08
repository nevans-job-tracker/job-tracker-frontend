import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ListPage from "./pages/ListPage.jsx";
import ApplicationPage from "./pages/ApplicationPage.jsx";
import InsightsPage from "./pages/InsightsPage.jsx";
import BuildMarker from "./components/BuildMarker.jsx";

export default function App() {
  // The list gets a wider container than the rest of the app (KAN-80).
  //
  // 1100px is a reading width, chosen for the detail form, where long lines
  // are harder to scan and every field is prose or a short value. The list is
  // a table: its twelve columns need 1175px, so that same cap forced it to
  // scroll on a monitor with room to spare, leaving ~160px of empty gutter on
  // either side of a clipped table. Sizing a table by a form's needs is what
  // was wrong.
  //
  // Route-aware rather than a wider `.container` for everything, because that
  // would drag the form out to 1400px too. This element wraps every route, so
  // the width has to be chosen per route or not at all.
  const wide = useLocation().pathname === "/";

  return (
    <div className={wide ? "container container-wide" : "container"}>
      {/* Above the routes so it is on every screen: which build you are
          looking at is not a property of one page (KAN-63). */}
      <BuildMarker />
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        {/* "new" must precede ":id" so it isn't swallowed as an id */}
        <Route path="/applications/new" element={<ApplicationPage />} />
        <Route path="/applications/:id" element={<ApplicationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
