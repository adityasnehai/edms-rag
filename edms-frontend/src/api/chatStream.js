import { fetchApi } from "./config";

export async function streamChat(message, history, onToken, topK) {
  const token = localStorage.getItem("access_token");
  const payload = { message, history };

  if (Number.isFinite(topK)) {
    payload.top_k = topK;
  }

  const res = await fetchApi("/chat/stream", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/";
    throw new Error("Session expired");
  }

  if (!res.ok || !res.body) {
    throw new Error("Chat failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    onToken(decoder.decode(value));
  }
}
