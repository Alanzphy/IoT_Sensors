import { api } from "../services/api";

export async function downloadBlobExport(endpoint: string, fileName: string): Promise<void> {
  const response = await api.get(endpoint, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.URL.revokeObjectURL(url);
  }
}