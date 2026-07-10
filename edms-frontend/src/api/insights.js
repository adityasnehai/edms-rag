import { apiFetch } from "./client";

export function fetchInsights(query, limit) {
  const params = new URLSearchParams();

  if (query && query.trim()) {
    params.set("q", query.trim());
  }

  if (Number.isFinite(limit)) {
    params.set("limit", String(limit));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/insights${suffix}`, {
    method: "GET",
  });
}
