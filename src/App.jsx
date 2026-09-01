import { Routes, Route, Navigate } from "react-router-dom";
import ListPage from "./pages/ListPage.jsx";
import ApplicationPage from "./pages/ApplicationPage.jsx";
import BuildMarker from "./components/BuildMarker.jsx";

export default function App() {
  return (
    <div className="container">
      {/* Above the routes so it is on every screen: which build you are
          looking at is not a property of one page (KAN-63). */}
      <BuildMarker />
      <Routes>
        <Route path="/" element={<ListPage />} />
        {/* "new" must precede ":id" so it isn't swallowed as an id */}
        <Route path="/applications/new" element={<ApplicationPage />} />
        <Route path="/applications/:id" element={<ApplicationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
