import { fetchApi, isApiUnavailableError } from "./config";
import { containsStaleIndexError } from "../utils/chatSanitizer";

const CHAT_RETRY_DELAY_MS = 400;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTransientApiRetry(task) {
  try {
    return await task();
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }
    await delay(CHAT_RETRY_DELAY_MS);
    return task();
  }
}

async function readErrorMessage(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    return data?.detail || fallbackMessage;
  }

  const text = await response.text().catch(() => "");
  return text || fallbackMessage;
}

export async function streamChat(message, history, onToken, topK) {
  const token = localStorage.getItem("access_token");
  const payload = { message, history };

  if (Number.isFinite(topK)) {
    payload.top_k = topK;
  }

  const res = await withTransientApiRetry(() =>
    fetchApi("/chat/stream", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired");
  }

  if (!res.ok || !res.body) {
    throw new Error(await readErrorMessage(res, "Chat failed"));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (containsStaleIndexError(chunk)) {
      continue;
    }
    fullText += chunk;
    onToken(chunk);
  }

  const finalChunk = decoder.decode();
  if (finalChunk && !containsStaleIndexError(finalChunk)) {
    fullText += finalChunk;
    onToken(finalChunk);
  }

  return fullText;
}

export async function sendChat(message, history, topK) {
  const token = localStorage.getItem("access_token");
  const payload = { message, history };

  if (Number.isFinite(topK)) {
    payload.top_k = topK;
  }

  const res = await withTransientApiRetry(() =>
    fetchApi("/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Chat failed"));
  }

  return res.json();
}
