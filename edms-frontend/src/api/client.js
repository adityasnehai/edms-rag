import { fetchApi } from "./config";
import { refreshSession } from "./auth";
import { clearSession, getRefreshToken, setSession } from "../utils/auth";

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("access_token");
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetchApi(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";

  // 🔐 TOKEN EXPIRED / INVALID
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshed = await refreshSession(refreshToken);
        setSession(refreshed.access_token, refreshed.refresh_token);
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${refreshed.access_token}`,
        };
        const retryRes = await fetchApi(url, {
          ...options,
          headers: retryHeaders,
        });
        if (retryRes.ok) {
          const retryType = retryRes.headers.get("content-type") || "";
          if (!retryType.includes("application/json")) {
            throw new Error("Invalid API response from the EDMS backend.");
          }
          return retryRes.json();
        }
      } catch {
        clearSession();
      }
    }
    clearSession();
    sessionStorage.setItem("edms:session-expired", "1");
    window.location.href = "/";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || "API error");
    }

    const text = await res.text();
    throw new Error(text || "API error");
  }

  if (!contentType.includes("application/json")) {
    throw new Error("Invalid API response from the EDMS backend.");
  }

  return res.json();
}
