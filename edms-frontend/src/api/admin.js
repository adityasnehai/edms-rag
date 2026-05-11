import { apiFetch } from "./client";

export async function uploadDocument(files, dataType) {
  const formData = new FormData();
  formData.append("data_type", dataType);
  for (const file of files) {
    formData.append("files", file);
  }

  return apiFetch("/admin/upload", {
    method: "POST",
    body: formData,
  });
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

export function fetchDataTypeSummary() {
  return apiFetch("/admin/ingestion/data-types", {
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

export function listDataFiles({ dataType = "", query = "" } = {}) {
  const params = new URLSearchParams();
  if (dataType) {
    params.set("data_type", dataType);
  }
  if (query) {
    params.set("q", query);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/admin/data/files${suffix}`, {
    method: "GET",
  });
}

export function previewDataFile({ dataType, filename }) {
  const params = new URLSearchParams({
    data_type: dataType,
    filename,
  });

  return apiFetch(`/admin/data/files/preview?${params.toString()}`, {
    method: "GET",
  });
}

export async function replaceDataFile({ dataType, filename, file }) {
  const formData = new FormData();
  formData.append("data_type", dataType);
  formData.append("filename", filename);
  formData.append("file", file);

  return apiFetch("/admin/data/files/replace", {
    method: "POST",
    body: formData,
  });
}

export function deleteDataFile({ dataType, filename }) {
  const params = new URLSearchParams({
    data_type: dataType,
    filename,
  });

  return apiFetch(`/admin/data/files?${params.toString()}`, {
    method: "DELETE",
  });
}
