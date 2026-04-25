import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import EvidenceBrowser from "./pages/EvidenceBrowser";
import AdminAccess from "./pages/AdminAccess";
import AdminUpload from "./pages/AdminUpload";
import AdminEvaluation from "./pages/AdminEvaluation";

import ProtectedRoute from "./components/ProtectedRoute";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/" element={<Login />} />

        {/* User routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/evidence"
          element={
            <ProtectedRoute>
              <EvidenceBrowser />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/access"
          element={
            <ProtectedRoute requireAdmin>
              <AdminAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminUpload />
            </ProtectedRoute>
          }
        />
        {/* RAG Evaluation */}
        <Route
          path="/admin/eval"
          element={
            <ProtectedRoute requireAdmin>
              <AdminEvaluation />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
