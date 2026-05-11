export const STALE_INDEX_ERROR_TEXT = "The knowledge index is currently unavailable.";

export function containsStaleIndexError(value) {
  return typeof value === "string" && value.includes(STALE_INDEX_ERROR_TEXT);
}

export function sanitizeChatContent(value) {
  if (!containsStaleIndexError(value)) {
    return value || "";
  }

  return "";
}

export function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter((message) => !containsStaleIndexError(message?.content));
}
