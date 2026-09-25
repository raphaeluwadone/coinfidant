import { api } from "./api";

/** Fetches the export through the API client (so an expired access token refreshes) and saves it as a file. */
export async function downloadExport() {
  const data = await api<unknown>("/me/export");
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `coinfidant-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const deleteAccount = () => api<void>("/me/delete", { method: "POST", json: { confirm: "DELETE" } });
