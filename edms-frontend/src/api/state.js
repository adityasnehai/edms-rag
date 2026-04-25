import { apiFetch } from "./client";

export function fetchChatThreads() {
  return apiFetch("/state/chat/threads", { method: "GET" });
}

export function saveChatThread(thread) {
  return apiFetch(`/state/chat/threads/${encodeURIComponent(thread.id)}`, {
    method: "PUT",
    body: JSON.stringify(thread),
  });
}

export function deleteChatThread(threadId) {
  return apiFetch(`/state/chat/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
  });
}

export function fetchRecentSearches() {
  return apiFetch("/state/recent-searches", { method: "GET" });
}

export function saveRecentSearch(query, result) {
  return apiFetch("/state/recent-searches", {
    method: "POST",
    body: JSON.stringify({ query, result }),
  });
}

export function clearRecentSearches() {
  return apiFetch("/state/recent-searches", { method: "DELETE" });
}
