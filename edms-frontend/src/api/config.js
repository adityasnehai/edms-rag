const HARD_PINNED_API_BASE = "https://edms-api-e2bc.onrender.com";
const configuredApiBase = HARD_PINNED_API_BASE;
const commonBackendPorts = [8000, 8001, 8002, 8010, 8011, 8012];
const FETCH_ATTEMPT_TIMEOUT_MS = 3200;
const FETCH_TOTAL_TIMEOUT_MS = 14000;
const FETCH_RETRY_DELAY_MS = 250;
const FETCH_MAX_CYCLES = 3;
const LAST_WORKING_API_BASE_KEY = "edms:last_api_base";
const API_UNAVAILABLE_ERROR = "Cannot reach the EDMS API. Start the backend server and try again.";

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
  const safeProtocol = protocol === "http:" || protocol === "https:" ? protocol : "http:";

  if (isLocalNetworkHost(hostname)) {
    return `${safeProtocol}//${resolvedHost}:8001`;
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
  const lastWorkingBase =
    typeof window !== "undefined"
      ? window.localStorage.getItem(LAST_WORKING_API_BASE_KEY)?.trim()
      : "";
  const isLikelyRemoteCached =
    Boolean(lastWorkingBase) &&
    !isLocalNetworkHost((() => {
      try {
        return new URL(lastWorkingBase).hostname;
      } catch {
        return "";
      }
    })());
  const safeLastWorkingBase = isLikelyRemoteCached ? "" : lastWorkingBase;

  if (typeof window === "undefined") {
    return dedupeBases([
      configuredApiBase,
      defaultBase,
      "http://127.0.0.1:8001",
      "http://127.0.0.1:8011",
    ]);
  }

  const { protocol, hostname, origin } = window.location;
  const resolvedHost = hostname === "0.0.0.0" ? "127.0.0.1" : hostname;
  const safeProtocol = protocol === "http:" || protocol === "https:" ? protocol : "http:";

  if (!isLocalNetworkHost(hostname)) {
    return dedupeBases([safeLastWorkingBase, configuredApiBase, defaultBase, origin]);
  }

  const hostCandidates = commonBackendPorts.map(
    (port) => `${safeProtocol}//${resolvedHost}:${port}`
  );
  const loopbackCandidates = commonBackendPorts.map(
    (port) => `${safeProtocol}//127.0.0.1:${port}`
  );
  const localhostCandidates = commonBackendPorts.map(
    (port) => `${safeProtocol}//localhost:${port}`
  );
  const explicitHttpHostCandidates = commonBackendPorts.map(
    (port) => `http://${resolvedHost}:${port}`
  );
  const explicitHttpLoopbackCandidates = commonBackendPorts.map(
    (port) => `http://127.0.0.1:${port}`
  );
  const explicitHttpLocalhostCandidates = commonBackendPorts.map(
    (port) => `http://localhost:${port}`
  );
  const explicitHttpsHostCandidates = commonBackendPorts.map(
    (port) => `https://${resolvedHost}:${port}`
  );
  const explicitHttpsLoopbackCandidates = commonBackendPorts.map(
    (port) => `https://127.0.0.1:${port}`
  );
  const explicitHttpsLocalhostCandidates = commonBackendPorts.map(
    (port) => `https://localhost:${port}`
  );

  const localCandidates = dedupeBases([
    defaultBase,
    `http://${resolvedHost}:8001`,
    "http://127.0.0.1:8001",
    "http://localhost:8001",
    safeLastWorkingBase,
    configuredApiBase,
    `http://${resolvedHost}:8011`,
    "http://127.0.0.1:8011",
    "http://localhost:8011",
    ...hostCandidates.slice(0, 2),
    ...loopbackCandidates.slice(0, 2),
    ...localhostCandidates.slice(0, 2),
    ...explicitHttpHostCandidates.slice(0, 2),
    ...explicitHttpLoopbackCandidates.slice(0, 2),
    ...explicitHttpLocalhostCandidates.slice(0, 2),
    ...explicitHttpsHostCandidates.slice(0, 1),
    ...explicitHttpsLoopbackCandidates.slice(0, 1),
    ...explicitHttpsLocalhostCandidates.slice(0, 1),
  ]);
  return localCandidates;
}

export const API_BASE = normalizeApiBase(HARD_PINNED_API_BASE);
export const API_BASE_CANDIDATES = [API_BASE];
export const API_UNAVAILABLE_ERROR_TEXT = API_UNAVAILABLE_ERROR;

export function buildApiUrl(path, base = API_BASE) {
  return `${base}${path}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isApiUnavailableError(error) {
  return (error?.message || "") === API_UNAVAILABLE_ERROR;
}

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

export async function fetchApi(path, options = {}) {
  let sawNonApiHtml = false;
  const startedAt = Date.now();
  const cycles = Math.max(1, FETCH_MAX_CYCLES);

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const base of API_BASE_CANDIDATES) {
      if (Date.now() - startedAt > FETCH_TOTAL_TIMEOUT_MS) {
        break;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_ATTEMPT_TIMEOUT_MS);
      try {
        const response = await fetch(buildApiUrl(path, base), {
          ...options,
          signal: options.signal || controller.signal,
        });
        clearTimeout(timeoutId);

        if (isHtmlResponse(response)) {
          sawNonApiHtml = true;
          continue;
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_WORKING_API_BASE_KEY, base);
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error?.name === "AbortError" && options.signal) {
          throw error;
        }
      }
    }

    if (options.signal?.aborted || Date.now() - startedAt > FETCH_TOTAL_TIMEOUT_MS || cycle === cycles - 1) {
      break;
    }

    await delay(FETCH_RETRY_DELAY_MS);
  }

  if (sawNonApiHtml) {
    throw new Error(API_UNAVAILABLE_ERROR);
  }

  throw new Error(API_UNAVAILABLE_ERROR);
}
