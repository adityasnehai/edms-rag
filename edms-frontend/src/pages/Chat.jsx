import { useEffect, useRef, useState } from "react";

import {
  deleteChatThread as deleteChatThreadApi,
  fetchChatThreads,
  saveChatThread as saveChatThreadApi,
} from "../api/state";
import { sendChat, streamChat } from "../api/chatStream";
import ChatBubble from "../components/ChatBubble";
import ChatInput from "../components/ChatInput";
import WorkspaceShell from "../components/WorkspaceShell";
import usePageTitle from "../hooks/usePageTitle";
import {
  containsStaleIndexError,
  sanitizeChatMessages,
} from "../utils/chatSanitizer";
import {
  ChatIcon,
  ClockIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  TrashIcon,
} from "../components/AppIcons";

const SUGGESTIONS = [
  "Summarize the ADRs uploaded in this workspace.",
  "What decisions changed after the last postmortem?",
  "List action items from recent meeting notes.",
  "What tickets mention the current architecture risk?",
];

function createThreadId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildThreadTitle(text) {
  const normalized = (text || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  if (normalized.length <= 58) return normalized;
  return `${normalized.slice(0, 57).trimEnd()}…`;
}

function buildThreadPreview(messages) {
  const latestMessage = [...messages].reverse().find((m) => m?.content?.trim());
  if (!latestMessage) return "Saved workspace conversation";
  const normalized = latestMessage.content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 78) return normalized;
  return `${normalized.slice(0, 77).trimEnd()}…`;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return sanitizeChatMessages(messages)
    .filter((m) => m && typeof m === "object")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : "",
    }));
}

function sortThreadsByRecent(threads) {
  return [...threads].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime(),
  );
}

function normalizeThread(thread, index) {
  const messages = sanitizeMessages(thread?.messages);
  const firstUserMessage = messages.find((m) => m.role === "user" && m.content.trim())?.content || "";
  const createdAt = typeof thread?.createdAt === "string" ? thread.createdAt : new Date(Date.now() - index).toISOString();
  const updatedAt = typeof thread?.updatedAt === "string" ? thread.updatedAt : createdAt;
  return {
    id: typeof thread?.id === "string" && thread.id.trim() ? thread.id : createThreadId(),
    title: typeof thread?.title === "string" && thread.title.trim() ? thread.title : buildThreadTitle(firstUserMessage),
    messages,
    createdAt,
    updatedAt,
  };
}

function normalizeStoredChatState(value) {
  if (!value || typeof value !== "object") return { threads: [], activeThreadId: null };
  const threads = sortThreadsByRecent(
    (Array.isArray(value.threads) ? value.threads : []).map((t, i) => normalizeThread(t, i)),
  );
  const activeThreadId =
    typeof value.activeThreadId === "string" && threads.some((t) => t.id === value.activeThreadId)
      ? value.activeThreadId
      : threads[0]?.id || null;
  return { threads, activeThreadId };
}

function sanitizeThreads(threads) {
  return (Array.isArray(threads) ? threads : [])
    .map((thread) => ({
      ...thread,
      messages: sanitizeChatMessages(thread?.messages || []),
    }))
    .filter((thread) => thread.messages.length > 0);
}

function formatThreadTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(undefined, sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }).format(date);
}

function appendAssistantChunk(messages, chunk) {
  if (containsStaleIndexError(chunk)) {
    return sanitizeChatMessages(messages);
  }
  const nextMessages = [...messages];
  const lastIndex = nextMessages.length - 1;
  if (lastIndex < 0) return nextMessages;
  nextMessages[lastIndex] = { ...nextMessages[lastIndex], content: `${nextMessages[lastIndex].content || ""}${chunk}` };
  return sanitizeChatMessages(nextMessages);
}

export default function Chat() {
  usePageTitle("Chat");
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const bottomRef = useRef(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const messages = sanitizeChatMessages(activeThread?.messages || []);
  const activeThreadUpdatedAt = activeThread?.updatedAt || null;

  useEffect(() => {
    let cancelled = false;
    async function loadThreads() {
      try {
        const data = await fetchChatThreads();
        if (cancelled) return;
        const normalized = normalizeStoredChatState({
          threads: data?.threads || [],
          activeThreadId: data?.threads?.[0]?.id || null,
        });
        setThreads(normalized.threads);
        setActiveThreadId(normalized.activeThreadId);
      } catch {
        if (!cancelled) { setThreads([]); setActiveThreadId(null); }
      }
    }
    loadThreads();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeThreadId && !threads.some((t) => t.id === activeThreadId)) {
      setActiveThreadId(threads[0]?.id || null);
    }
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (threads.some((thread) => thread.messages.some((message) => containsStaleIndexError(message?.content)))) {
      setThreads((prev) => sortThreadsByRecent(sanitizeThreads(prev)));
    }
  }, [threads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadId, activeThreadUpdatedAt]);

  function startNewChat() {
    if (!isStreaming) {
      setActiveThreadId(null);
      setThreadMenuOpen(false);
    }
  }

  async function deleteThread(threadId) {
    if (!threadId || isStreaming) return;
    const remaining = threads.filter((t) => t.id !== threadId);
    setThreads(remaining);
    try { await deleteChatThreadApi(threadId); } catch { /* ignore */ }
    if (activeThreadId === threadId) setActiveThreadId(remaining[0]?.id || null);
    setThreadMenuOpen(false);
  }

  function clearActiveChat() { if (activeThreadId) deleteThread(activeThreadId); }

  async function sendMessage(text) {
    const messageText = text.trim();
    if (!messageText || isStreaming) return;

    const timestamp = new Date().toISOString();
    const userMsg = { role: "user", content: messageText };
    const assistantMsg = { role: "assistant", content: "" };
    const currentThread = threads.find((t) => t.id === activeThreadId) || null;
    const history = currentThread?.messages || [];
    let targetThreadId = currentThread?.id || null;

    if (!targetThreadId) {
      targetThreadId = createThreadId();
      const newThread = { id: targetThreadId, title: buildThreadTitle(messageText), messages: [userMsg, assistantMsg], createdAt: timestamp, updatedAt: timestamp };
      setThreads((prev) => sortThreadsByRecent([newThread, ...prev.filter((t) => t.id !== targetThreadId)]));
      setActiveThreadId(targetThreadId);
    } else {
      setThreads((prev) =>
        sortThreadsByRecent(prev.map((t) =>
          t.id === targetThreadId
            ? { ...t, title: t.messages.length === 0 ? buildThreadTitle(messageText) : t.title, updatedAt: timestamp, messages: [...t.messages, userMsg, assistantMsg] }
            : t,
        )),
      );
    }

    setIsStreaming(true);
    const persistThread = async (threadId) => {
      const thread = threads.find((item) => item.id === threadId) || (threadId === targetThreadId
        ? (currentThread
          ? { ...currentThread, messages: [...history, userMsg, assistantMsg] }
          : { id: targetThreadId, title: buildThreadTitle(messageText), messages: [userMsg, assistantMsg], createdAt: timestamp, updatedAt: timestamp })
        : null);
      if (thread) { try { await saveChatThreadApi(thread); } catch { /* ignore */ } }
    };

    try {
      let assistantContent = "";
      const streamedContent = await streamChat(messageText, history, (chunk) => {
        if (!containsStaleIndexError(chunk)) {
          assistantContent += chunk;
        }
        setThreads((prev) =>
          sortThreadsByRecent(sanitizeThreads(prev.map((t) =>
            t.id === targetThreadId
              ? { ...t, updatedAt: new Date().toISOString(), messages: appendAssistantChunk(t.messages, chunk) }
              : t,
          ))),
        );
      });
      assistantContent = assistantContent || streamedContent || "";

      if (!assistantContent.trim()) {
        const fallbackResult = await sendChat(messageText, history);
        const fallbackAnswer = sanitizeChatMessages([
          { role: "assistant", content: fallbackResult?.answer || "" },
        ])[0]?.content || "";

        assistantContent = fallbackAnswer.trim()
          ? fallbackAnswer
          : "I did not receive an answer from the backend. Please try again.";

        setThreads((prev) =>
          sortThreadsByRecent(sanitizeThreads(prev.map((t) => {
            if (t.id !== targetThreadId) return t;
            const nextMessages = [...t.messages];
            const lastIndex = nextMessages.length - 1;
            if (lastIndex >= 0) {
              nextMessages[lastIndex] = {
                ...nextMessages[lastIndex],
                content: assistantContent,
              };
            }
            return {
              ...t,
              updatedAt: new Date().toISOString(),
              messages: nextMessages,
            };
          }))),
        );
      }

      const finishedThread = {
        ...(currentThread || {
          id: targetThreadId,
          title: buildThreadTitle(messageText),
          createdAt: timestamp,
        }),
        id: targetThreadId,
        title: currentThread?.title || buildThreadTitle(messageText),
        messages: sanitizeChatMessages([
          ...history,
          userMsg,
          { role: "assistant", content: assistantContent },
        ]),
        updatedAt: new Date().toISOString(),
      };
      await saveChatThreadApi(finishedThread);
    } catch (error) {
      setThreads((prev) =>
        sortThreadsByRecent(prev.map((t) => {
          if (t.id !== targetThreadId) return t;
          const nextMessages = [...t.messages];
          const lastIndex = nextMessages.length - 1;
          if (lastIndex >= 0) nextMessages[lastIndex] = { ...nextMessages[lastIndex], content: error.message || "Chat failed. Please try again." };
          return { ...t, updatedAt: new Date().toISOString(), messages: nextMessages };
        })),
      );
      await persistThread(targetThreadId);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <WorkspaceShell mainClassName="flex min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur-xl">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Persistent Chat
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground lg:text-2xl">
              Workspace conversation
            </h1>
          </div>

          <button
            type="button"
            onClick={startNewChat}
            disabled={isStreaming}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-4 py-2.5 text-sm font-semibold text-[#251f19] shadow-sm transition hover:border-[#f48d16]/35 hover:bg-[#ffeed2] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            New Chat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl py-5 lg:py-6">
          <section className="animate-fade-up overflow-hidden rounded-[28px] border border-border bg-white/85 shadow-card backdrop-blur-sm">
            <div className="flex flex-col gap-3 border-b border-border bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a76311]">
                    Active Chat
                  </span>
                  {activeThread?.updatedAt && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {formatThreadTime(activeThread.updatedAt)}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 truncate text-base font-semibold text-foreground">
                  {activeThread?.title || "New workspace conversation"}
                </h2>
              </div>

              <div className="relative flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThreadMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
                >
                  <ChatIcon className="h-4 w-4 text-primary" />
                  Conversations
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {threads.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearActiveChat}
                  disabled={isStreaming || !activeThreadId}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Clear
                </button>

                {threadMenuOpen && (
                  <div className="absolute right-0 top-12 z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Conversations
                      </p>
                      <button
                        type="button"
                        onClick={startNewChat}
                        disabled={isStreaming}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#f48d16]/22 bg-[#fff4e1] px-2.5 py-1.5 text-xs font-semibold text-[#251f19] disabled:opacity-50"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        New
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-2">
                      {activeThreadId === null && (
                        <div className="mb-2 rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-2 text-xs text-primary">
                          New chat ready — send a message to save it.
                        </div>
                      )}
                      {threads.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-6 text-center text-xs text-muted-foreground">
                          No saved conversations yet.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {threads.map((thread) => {
                            const active = thread.id === activeThreadId;
                            return (
                              <div
                                key={thread.id}
                                className={`flex items-start gap-2 rounded-xl border p-3 transition ${
                                  active
                                    ? "border-[#f48d16]/22 bg-[#fff4e1]"
                                    : "border-transparent hover:border-border hover:bg-secondary/60"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveThreadId(thread.id);
                                    setThreadMenuOpen(false);
                                  }}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="line-clamp-1 text-xs font-semibold text-foreground">
                                      {thread.title}
                                    </p>
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      {formatThreadTime(thread.updatedAt)}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                    {buildThreadPreview(thread.messages)}
                                  </p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteThread(thread.id)}
                                  disabled={isStreaming}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={`Delete ${thread.title}`}
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-[48vh] bg-white/55 p-4 sm:p-5">
              {messages.length === 0 ? (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-border bg-white/80 p-7 text-center">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      Ask your workspace anything
                    </h2>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-muted-foreground">
                      Search ADRs, tickets, diagrams, notes, and postmortems in one focused thread.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => sendMessage(suggestion)}
                        className="flex items-start gap-3 rounded-[20px] border border-border bg-white/80 p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff4e1] text-primary">
                          {index % 2 === 0 ? <ChatIcon className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
                        </div>
                        <p className="text-sm font-medium leading-6 text-foreground">{suggestion}</p>
                      </button>
                    ))}
                  </div>
                  <div ref={bottomRef} />
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((message, index) => (
                    <ChatBubble
                      key={`${activeThread?.id || "chat"}-${index}`}
                      role={message.role}
                      text={message.content}
                      isLoading={
                        isStreaming &&
                        message.role === "assistant" &&
                        index === messages.length - 1 &&
                        !message.content?.trim()
                      }
                    />
                  ))}

                  {isStreaming && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <SparkleIcon className="h-3.5 w-3.5 animate-pulse-soft text-primary" />
                      MemoStack is analyzing evidence…
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <ChatInput onSend={sendMessage} disabled={isStreaming} embedded />
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
