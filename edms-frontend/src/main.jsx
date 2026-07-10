import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import EvidenceBrowser from "./pages/EvidenceBrowser";
import AdminAccess from "./pages/AdminAccess";
import AdminDataManager from "./pages/AdminDataManager";
import AdminUpload from "./pages/AdminUpload";
import NotFound from "./pages/NotFound";

import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import AppProviders from "./providers/AppProviders";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <AppProviders>
            <BrowserRouter>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Home />} />

                {/* User routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/evidence" element={<ProtectedRoute><EvidenceBrowser /></ProtectedRoute>} />

                {/* Admin routes */}
                <Route path="/admin/access" element={<ProtectedRoute requireAdmin><AdminAccess /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminUpload /></ProtectedRoute>} />
                <Route path="/admin/data" element={<ProtectedRoute requireAdmin><AdminDataManager /></ProtectedRoute>} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AppProviders>
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
);
