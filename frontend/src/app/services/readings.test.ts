import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { fetchChartReadings } from "./readings";
vi.mock("./api", () => ({ api: { get: vi.fn() } }));
afterEach(() => vi.clearAllMocks());
it("bounds charts at 1600 readings and returns total so truncation is explicit", async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: Array.from({ length: 200 }, (_, id) => ({ id })), total: 2000, page: 1, per_page: 200 } });
  const controller = new AbortController();
  const result = await fetchChartReadings("irrigation_area_id=12&crop_cycle_id=3", controller.signal);
  expect(result.readings).toHaveLength(1600);
  expect(result.total).toBe(2000);
  expect(api.get).toHaveBeenCalledTimes(8);
  expect(api.get).toHaveBeenLastCalledWith("/readings?irrigation_area_id=12&crop_cycle_id=3&page=8&per_page=200", { signal: controller.signal });
});
it("stops requests when filters change and the old request is cancelled", async () => {
  const controller = new AbortController();
  vi.mocked(api.get).mockImplementation(async () => { controller.abort(); return { data: { data: [{ id: 1 }], total: 5 } }; });
  await expect(fetchChartReadings("irrigation_area_id=12", controller.signal)).rejects.toThrow("Cancelled");
  expect(api.get).toHaveBeenCalledTimes(1);
});
