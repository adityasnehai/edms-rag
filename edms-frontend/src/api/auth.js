import { fetchApi } from "./config";

async function authRequest(path, payload) {
  const res = await fetchApi(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  const text = isJson ? "" : await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(
      data?.detail ||
        text.trim() ||
        "Cannot complete authentication. Check that the EDMS backend is running."
    );
  }

  if (!data) {
    throw new Error("Invalid authentication response from the EDMS API.");
  }

  return data;
}

export function loginUser(email, password) {
  return authRequest("/auth/login", { email, password });
}

export function registerUser(payload) {
  return authRequest("/auth/register", payload);
}

export function refreshSession(refresh_token) {
  return authRequest("/auth/refresh", { refresh_token });
}

export function logoutSession(refresh_token) {
  return authRequest("/auth/logout", { refresh_token });
}

export function logoutAllSessions(refresh_token) {
  return authRequest("/auth/logout-all", { refresh_token });
}
