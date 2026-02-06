import { apiFetch } from "./client";

export function fetchEvalMetrics() {return apiFetch("/eval", { method: "GET" });}
