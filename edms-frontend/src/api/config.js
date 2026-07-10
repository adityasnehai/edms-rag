const REMOTE_API_BASE = "https://edms-api-e2bc.onrender.com";
const FETCH_ATTEMPT_TIMEOUT_MS = 60000;
const FETCH_TOTAL_TIMEOUT_MS = 120000;
const FETCH_RETRY_DELAY_MS = 250;
const FETCH_MAX_CYCLES = 3;
const LAST_WORKING_API_BASE_KEY = "edms:last_api_base";
const API_UNAVAILABLE_ERROR = "Cannot reach the MemoStack API. Start the backend server and try again.";

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
}

function normalizeApiBase(base) {
  return (base || "").replace(/\/+$/, "");
}

function getDefaultApiBase() {
  return isLocalBrowser() ? "http://127.0.0.1:8000" : "/api";
}

export const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_BASE ||
    getDefaultApiBase(),
);

function getApiBaseCandidates() {
  const localCandidates = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8001",
    "http://localhost:8001",
  ];
  const envCandidates = [
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_API_BASE,
    typeof window !== "undefined" ? window.localStorage.getItem(LAST_WORKING_API_BASE_KEY) : null,
    API_BASE,
    REMOTE_API_BASE,
  ]
    .map((value) => normalizeApiBase(value))
    .filter(Boolean);

  return Array.from(
    new Set([
      ...(isLocalBrowser() ? localCandidates : []),
      ...envCandidates,
    ]),
  );
}

export const API_BASE_CANDIDATES = getApiBaseCandidates();
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
