import { apiFetch } from "./client";

export function fetchEvalMetrics() {
  return apiFetch("/eval", {
    method: "GET",
  });
}

export function runEvalMetrics() {
  return apiFetch("/eval/run", {
    method: "POST",
  });
}
