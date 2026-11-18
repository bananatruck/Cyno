import { describe, expect, it, vi } from "vitest";
import { fetchCloudForecast, mapOpenMeteoToCloudSamples } from "./weather";

describe("weather", () => {
  it("maps an Open-Meteo JSON body to CloudSample[] with ISO UTC timestamps", () => {
    const body = {
      latitude: 33.77,
      longitude: -118.19,
      hourly: {
        time: ["2026-11-17T20:00", "2026-11-17T21:00", "2026-11-17T22:00"],
        cloud_cover: [15, 40, 85],
      },
    };

    const samples = mapOpenMeteoToCloudSamples(body);
    expect(samples).toEqual([
      { time: "2026-11-17T20:00:00.000Z", percent: 15 },
      { time: "2026-11-17T21:00:00.000Z", percent: 40 },
      { time: "2026-11-17T22:00:00.000Z", percent: 85 },
    ]);
  });

  it("fetches and maps Open-Meteo forecast when within range", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: ["2026-11-17T18:00", "2026-11-17T19:00"],
          cloud_cover: [10, 25],
        },
      }),
    });

    const result = await fetchCloudForecast(33.77, -118.19, "2026-11-17", {
      now: new Date("2026-11-17T20:00:00Z"),
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ok");
    expect(result.samples).toEqual([
      { time: "2026-11-17T18:00:00.000Z", percent: 10 },
      { time: "2026-11-17T19:00:00.000Z", percent: 25 },
    ]);
  });

  it("returns offline when fetch rejects", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchCloudForecast(33.77, -118.19, "2026-11-17", {
      now: new Date("2026-11-17T20:00:00Z"),
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result).toEqual({
      samples: [],
      status: "offline",
    });
  });

  it("skips fetch and returns out-of-range for dates beyond 16 days", async () => {
    const mockFetch = vi.fn();

    const result = await fetchCloudForecast(33.77, -118.19, "2026-12-25", {
      now: new Date("2026-11-17T20:00:00Z"),
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      samples: [],
      status: "out-of-range",
    });
  });
});
