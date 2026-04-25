import { apiFetch } from "./client";
import { fetchApi } from "./config";

export async function uploadDocument(files, dataType) {
  const token = localStorage.getItem("access_token");

  const formData = new FormData();
  formData.append("data_type", dataType);
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetchApi("/admin/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || "Upload failed");
  }

  return data;
}

export function fetchIngestionJob(jobId) {
  return apiFetch(`/admin/ingestion/jobs/${jobId}`, {
    method: "GET",
  });
}

export function listIngestionJobs(limit = 10) {
  return apiFetch(`/admin/ingestion/jobs?limit=${encodeURIComponent(limit)}`, {
    method: "GET",
  });
}

export function fetchOrganizationDetails() {
  return apiFetch("/admin/organization", {
    method: "GET",
  });
}

export function rotateOrganizationInviteCode() {
  return apiFetch("/admin/organization/invite-code/rotate", {
    method: "POST",
  });
}
