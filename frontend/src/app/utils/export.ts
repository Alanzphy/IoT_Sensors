import { api } from "../services/api";

export async function downloadBlobExport(endpoint: string, fileName: string): Promise<void> {
  const response = await api.get(endpoint, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(response.data instanceof Blob ? response.data : new Blob([response.data]));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}