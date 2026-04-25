const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();

function isPrivateIpv4Host(hostname) {
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

function isLocalNetworkHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    isPrivateIpv4Host(hostname)
  );
}

function getDefaultApiBase() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8001";
  }

  const { protocol, hostname, origin } = window.location;
  const resolvedHost = hostname === "0.0.0.0" ? "127.0.0.1" : hostname;

  if (isLocalNetworkHost(hostname)) {
    return `${protocol}//${resolvedHost}:8001`;
  }

  return origin;
}

function normalizeApiBase(base) {
  return (base || "").replace(/\/+$/, "");
}

function dedupeBases(bases) {
  return [...new Set(bases.filter(Boolean).map(normalizeApiBase))];
}

function getApiBaseCandidates() {
  const defaultBase = getDefaultApiBase();

  if (typeof window === "undefined") {
    return dedupeBases([configuredApiBase, defaultBase, "http://127.0.0.1:8000"]);
  }

  const { protocol, hostname, origin } = window.location;
  const resolvedHost = hostname === "0.0.0.0" ? "127.0.0.1" : hostname;

  if (!isLocalNetworkHost(hostname)) {
    return dedupeBases([configuredApiBase, defaultBase, origin]);
  }

  return dedupeBases([
    configuredApiBase,
    defaultBase,
    `${protocol}//${resolvedHost}:8001`,
    `${protocol}//${resolvedHost}:8000`,
    `${protocol}//127.0.0.1:8001`,
    `${protocol}//127.0.0.1:8000`,
    `${protocol}//localhost:8001`,
    `${protocol}//localhost:8000`,
  ]);
}

export const API_BASE = normalizeApiBase(configuredApiBase || getDefaultApiBase());
export const API_BASE_CANDIDATES = getApiBaseCandidates();

export function buildApiUrl(path, base = API_BASE) {
  return `${base}${path}`;
}

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

export async function fetchApi(path, options = {}) {
  let sawNonApiHtml = false;

  for (const base of API_BASE_CANDIDATES) {
    try {
      const response = await fetch(buildApiUrl(path, base), options);

      if (isHtmlResponse(response)) {
        sawNonApiHtml = true;
        continue;
      }

      return response;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
    }
  }

  if (sawNonApiHtml) {
    throw new Error("Cannot reach the EDMS API. Start the backend server and try again.");
  }

  throw new Error("Cannot reach the EDMS API. Start the backend server and try again.");
}
