import { afterEach, expect, it, vi } from "vitest";
import { api } from "../services/api";
import { downloadBlobExport } from "./export";
vi.mock("../services/api", () => ({ api: { get: vi.fn() } }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("downloads the server blob and releases the temporary link and URL", async () => {
  const blob = new Blob(["humidity\n0"], { type: "text/csv" });
  vi.mocked(api.get).mockResolvedValue({ data: blob });
  const create = vi.fn().mockReturnValue("blob:local-test");
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe("lecturas.csv");
    expect(this.href).toBe("blob:local-test");
  });
  await downloadBlobExport("/readings/export?format=csv", "lecturas.csv");
  expect(api.get).toHaveBeenCalledWith("/readings/export?format=csv", { responseType: "blob" });
  expect(create).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith("blob:local-test");
  expect(document.querySelector('a[download]')).toBeNull();
});
it("propagates server errors without starting a download", async () => {
  vi.mocked(api.get).mockRejectedValue(new Error("unavailable"));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await expect(downloadBlobExport("/readings/export?format=pdf", "readings.pdf")).rejects.toThrow("unavailable");
  expect(click).not.toHaveBeenCalled();
});
