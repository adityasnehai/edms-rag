import { useEffect, useRef, useState } from "react";

import {
  deleteChatThread as deleteChatThreadApi,
  fetchChatThreads,
  saveChatThread as saveChatThreadApi,
} from "../api/state";
import { streamChat } from "../api/chatStream";
import ChatBubble from "../components/ChatBubble";
import ChatInput from "../components/ChatInput";
import WorkspaceShell from "../components/WorkspaceShell";
import { getAuthPayload } from "../utils/auth";
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
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildThreadTitle(text) {
  const normalized = (text || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "New chat";
  }

  if (normalized.length <= 58) {
    return normalized;
  }

  return `${normalized.slice(0, 57).trimEnd()}…`;
}

function buildThreadPreview(messages) {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => message?.content?.trim());

  if (!latestMessage) {
    return "Saved workspace conversation";
  }

  const normalized = latestMessage.content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 78) {
    return normalized;
  }

  return `${normalized.slice(0, 77).trimEnd()}…`;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: typeof message.content === "string" ? message.content : "",
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
  const firstUserMessage =
    messages.find((message) => message.role === "user" && message.content.trim())
      ?.content || "";
  const createdAt =
    typeof thread?.createdAt === "string"
      ? thread.createdAt
      : new Date(Date.now() - index).toISOString();
  const updatedAt =
    typeof thread?.updatedAt === "string" ? thread.updatedAt : createdAt;

  return {
    id:
      typeof thread?.id === "string" && thread.id.trim()
        ? thread.id
        : createThreadId(),
    title:
      typeof thread?.title === "string" && thread.title.trim()
        ? thread.title
        : buildThreadTitle(firstUserMessage),
    messages,
    createdAt,
    updatedAt,
  };
}

function normalizeStoredChatState(value) {
  if (!value || typeof value !== "object") {
    return { threads: [], activeThreadId: null };
  }

  const threads = sortThreadsByRecent(
    (Array.isArray(value.threads) ? value.threads : []).map((thread, index) =>
      normalizeThread(thread, index),
    ),
  );
  const activeThreadId =
    typeof value.activeThreadId === "string" &&
    threads.some((thread) => thread.id === value.activeThreadId)
      ? value.activeThreadId
      : threads[0]?.id || null;

  return { threads, activeThreadId };
}

function formatThreadTime(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat(
    undefined,
    sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  ).format(date);
}

function appendAssistantChunk(messages, chunk) {
  const nextMessages = [...messages];
  const lastIndex = nextMessages.length - 1;

  if (lastIndex < 0) {
    return nextMessages;
  }

  const lastMessage = nextMessages[lastIndex];
  nextMessages[lastIndex] = {
    ...lastMessage,
    content: `${lastMessage.content || ""}${chunk}`,
  };

  return nextMessages;
}

export default function Chat() {
  const payload = getAuthPayload();
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef(null);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) || null;
  const messages = activeThread?.messages || [];
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
        if (!cancelled) {
          setThreads([]);
          setActiveThreadId(null);
        }
      }
    }
    loadThreads();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(threads[0]?.id || null);
    }
  }, [activeThreadId, threads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadId, activeThreadUpdatedAt]);

  function startNewChat() {
    if (isStreaming) {
      return;
    }

    setActiveThreadId(null);
  }

  async function deleteThread(threadId) {
    if (!threadId || isStreaming) {
      return;
    }

    const remainingThreads = threads.filter((thread) => thread.id !== threadId);
    setThreads(remainingThreads);
    try {
      await deleteChatThreadApi(threadId);
    } catch (error) {
      void error;
    }

    if (activeThreadId === threadId) {
      setActiveThreadId(remainingThreads[0]?.id || null);
    }
  }

  function clearActiveChat() {
    if (!activeThreadId) {
      return;
    }

    deleteThread(activeThreadId);
  }

  async function sendMessage(text) {
    const messageText = text.trim();
    if (!messageText || isStreaming) {
      return;
    }

    const timestamp = new Date().toISOString();
    const userMsg = { role: "user", content: messageText };
    const assistantMsg = { role: "assistant", content: "" };
    const currentThread =
      threads.find((thread) => thread.id === activeThreadId) || null;
    const history = currentThread?.messages || [];

    let targetThreadId = currentThread?.id || null;

    if (!targetThreadId) {
      targetThreadId = createThreadId();
      const newThread = {
        id: targetThreadId,
        title: buildThreadTitle(messageText),
        messages: [userMsg, assistantMsg],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setThreads((previous) =>
        sortThreadsByRecent([
          newThread,
          ...previous.filter((thread) => thread.id !== targetThreadId),
        ]),
      );
      setActiveThreadId(targetThreadId);
    } else {
      setThreads((previous) =>
        sortThreadsByRecent(
          previous.map((thread) =>
            thread.id === targetThreadId
              ? {
                  ...thread,
                  title:
                    thread.messages.length === 0
                      ? buildThreadTitle(messageText)
                      : thread.title,
                  updatedAt: timestamp,
                  messages: [...thread.messages, userMsg, assistantMsg],
                }
              : thread,
          ),
        ),
      );
    }

    setIsStreaming(true);
    const persistThread = async (threadId) => {
      const thread = threads.find((item) => item.id === threadId)
        || (threadId === targetThreadId
          ? (currentThread
            ? {
                ...currentThread,
                messages: [...history, userMsg, assistantMsg],
              }
            : {
                id: targetThreadId,
                title: buildThreadTitle(messageText),
                messages: [userMsg, assistantMsg],
                createdAt: timestamp,
                updatedAt: timestamp,
              })
          : null);
      if (thread) {
        try {
          await saveChatThreadApi(thread);
        } catch (error) {
          void error;
        }
      }
    };

    try {
      await streamChat(messageText, history, (chunk) => {
        setThreads((previous) =>
          sortThreadsByRecent(
            previous.map((thread) =>
              thread.id === targetThreadId
                ? {
                    ...thread,
                    updatedAt: new Date().toISOString(),
                    messages: appendAssistantChunk(thread.messages, chunk),
                  }
                : thread,
            ),
          ),
        );
      });
      const finishedThread = (
        threads.find((thread) => thread.id === targetThreadId) || {
          id: targetThreadId,
          title: buildThreadTitle(messageText),
          messages: [...history, userMsg, assistantMsg],
          createdAt: timestamp,
          updatedAt: new Date().toISOString(),
        }
      );
      await saveChatThreadApi(finishedThread);
    } catch (error) {
      setThreads((previous) =>
        sortThreadsByRecent(
          previous.map((thread) => {
            if (thread.id !== targetThreadId) {
              return thread;
            }

            const nextMessages = [...thread.messages];
            const lastIndex = nextMessages.length - 1;
            if (lastIndex >= 0) {
              nextMessages[lastIndex] = {
                ...nextMessages[lastIndex],
                content: error.message || "Chat failed. Please try again.",
              };
            }

            return {
              ...thread,
              updatedAt: new Date().toISOString(),
              messages: nextMessages,
            };
          }),
        ),
      );
      await persistThread(targetThreadId);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <WorkspaceShell mainClassName="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">
              Persistent Chat
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Search with full conversation history
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Chats stay attached to {payload?.org_name || "this workspace"} so
              you can reopen previous conversations any time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startNewChat}
              disabled={isStreaming}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-card transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              New Chat
            </button>

            <button
              type="button"
              onClick={clearActiveChat}
              disabled={isStreaming || !activeThreadId}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-card transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
              Clear Chat
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="container py-6 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <div className="rounded-[28px] border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Chats
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-foreground">
                      Saved conversations
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={startNewChat}
                    disabled={isStreaming}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Create a new chat"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                {activeThreadId === null ? (
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
                    New chat ready. Ask a question to save it here.
                  </div>
                ) : null}

                {threads.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-background px-4 py-6 text-sm leading-6 text-muted-foreground">
                    No saved chats yet. Start a new conversation and it will stay
                    available in this list.
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {threads.map((thread) => {
                      const isActive = thread.id === activeThreadId;

                      return (
                        <div
                          key={thread.id}
                          className={[
                            "flex items-start gap-2 rounded-2xl border p-3 transition",
                            isActive
                              ? "border-primary/20 bg-accent shadow-sm"
                              : "border-border bg-background hover:border-primary/15 hover:bg-secondary/60",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveThreadId(thread.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="line-clamp-2 text-sm font-semibold leading-6 text-foreground">
                                {thread.title}
                              </p>
                              <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {formatThreadTime(thread.updatedAt)}
                              </span>
                            </div>

                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                              {buildThreadPreview(thread.messages)}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteThread(thread.id)}
                            disabled={isStreaming}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:border-border hover:bg-card hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${thread.title}`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <section className="min-w-0">
              {messages.length === 0 ? (
                <div className="animate-fade-up space-y-8">
                  <div className="rounded-[32px] border border-border bg-card p-8 text-center shadow-card">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-primary text-primary-foreground shadow-glow">
                      <SparkleIcon className="h-6 w-6" />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                      Ask your workspace anything
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                      Search ADRs, tickets, diagrams, notes, and postmortems in
                      one thread, then come back to the same conversation later.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {SUGGESTIONS.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => sendMessage(suggestion)}
                        className="rounded-3xl border border-border bg-card p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                            {index % 2 === 0 ? (
                              <ChatIcon className="h-5 w-5" />
                            ) : (
                              <SearchIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-6 text-foreground">
                              {suggestion}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[32px] border border-border bg-card p-5 shadow-card sm:p-6">
                  <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
                        Active Chat
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-foreground">
                        {activeThread?.title || "Workspace conversation"}
                      </h2>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {formatThreadTime(activeThread?.updatedAt)}
                    </div>
                  </div>

                  <div className="mt-6 space-y-6">
                    {messages.map((message, index) => (
                      <ChatBubble
                        key={`${activeThread?.id || "chat"}-${index}`}
                        role={message.role}
                        text={message.content}
                      />
                    ))}

                    {isStreaming ? (
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        EDMS is analyzing evidence...
                      </p>
                    ) : null}

                    <div ref={bottomRef} />
                  </div>
                </div>
              )}

              {messages.length === 0 ? <div ref={bottomRef} /> : null}
            </section>
          </div>
        </div>
      </div>

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </WorkspaceShell>
  );
}
