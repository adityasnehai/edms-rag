import { apiFetch } from "./client";

export function fetchEvidence() {
  return apiFetch("/evidence", {
    method: "GET",
  });
}
