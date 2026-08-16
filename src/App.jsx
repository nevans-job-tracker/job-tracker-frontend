import { Routes, Route, Navigate } from "react-router-dom";
import ListPage from "./pages/ListPage.jsx";
import ApplicationPage from "./pages/ApplicationPage.jsx";

export default function App() {
  return (
    <div className="container">
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
