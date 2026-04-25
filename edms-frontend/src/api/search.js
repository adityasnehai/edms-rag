import { apiFetch } from "./client";

export function searchQuery(query, topK) {
  const params = new URLSearchParams({
    q: query,
  });

  if (Number.isFinite(topK)) {
    params.set("top_k", String(topK));
  }

  return apiFetch(`/search?${params.toString()}`, {
    method: "GET",
  });
}
