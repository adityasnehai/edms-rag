export function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function getAuthPayload() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;

  const payload = parseJwt(token);
  if (!payload) {
    localStorage.removeItem("access_token");
    return null;
  }

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem("access_token");
    return null;
  }

  return payload;
}

export function getCurrentRole() {
  return getAuthPayload()?.role || "user";
}

export function getOrganizationName() {
  return getAuthPayload()?.org_name || "Organization";
}

export function getOrganizationSlug() {
  return getAuthPayload()?.org_slug || null;
}

export function isAdmin() {
  return getCurrentRole() === "admin";
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function setSession(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem("access_token", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  }
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}
