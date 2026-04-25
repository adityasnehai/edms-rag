import { Navigate } from "react-router-dom";
import { getAuthPayload, isAdmin } from "../utils/auth";

export default function ProtectedRoute({ children, requireAdmin }) {
  const payload = getAuthPayload();

  if (!payload) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
