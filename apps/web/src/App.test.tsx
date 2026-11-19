import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { usePlan } from "@/lib/usePlan";

vi.mock("@/lib/usePlan", () => ({ usePlan: vi.fn() }));
vi.mock("@/components/ui/stars-background", () => ({ StarsBackground: () => null }));
vi.mock("@/components/ui/shooting-stars", () => ({ ShootingStars: () => null }));

// Use the real DOM storage even when Node exposes its own localStorage global.
declare const jsdom: { window: Window };

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
  window.localStorage.clear();
  vi.mocked(usePlan).mockReturnValue({
    plan: null,
    status: "computing",
    errors: [],
    isWorkerError: false,
    weatherStatus: "loading",
    stalePlan: null,
    retry: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

const setting = () => screen.getByRole("checkbox", { name: "Use Open-Meteo cloud forecast" });

describe("forecast preference storage", () => {
  it("warns when opt-out cannot be saved while still disabling the current forecast", () => {
    render(<App />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    fireEvent.click(setting());

    expect(setting()).toHaveProperty("checked", false);
    expect(usePlan).toHaveBeenLastCalledWith(expect.anything(), expect.any(String), false);
    const warning = screen.getByRole("alert");
    expect(warning.textContent).toContain("could not be saved");
    expect(warning.textContent).toContain("After reload");
    expect(warning.textContent).toContain("send coordinates to Open-Meteo");
    expect(setting().getAttribute("aria-describedby")?.split(" ")).toContain(warning.id);
  });

  it("clears the warning when a later save succeeds and restores the saved opt-out on remount", () => {
    const view = render(<App />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    fireEvent.click(setting());
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(setting());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.localStorage.getItem("cyno:weather-enabled")).toBe("1");
    fireEvent.click(setting());
    expect(window.localStorage.getItem("cyno:weather-enabled")).toBe("0");
    view.unmount();
    render(<App />);
    expect(setting()).toHaveProperty("checked", false);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
