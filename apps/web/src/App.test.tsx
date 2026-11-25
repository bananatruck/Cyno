import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { usePlan } from "@/lib/usePlan";

vi.mock("@/lib/usePlan", () => ({ usePlan: vi.fn() }));
vi.mock("@/components/ui/starfield", () => ({ StarsBackground: () => null }));
vi.mock("@/components/ui/shooting-star", () => ({ ShootingStars: () => null }));

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

describe("plan address", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  // The footer says coordinates stay in the browser when the forecast is off, so the plan lives in the
  // fragment, which browsers never send to the page host, not in the query string.
  it("moves a query-string plan link into the fragment and keeps it there", () => {
    window.history.replaceState(null, "", "/?lat=10.5&lon=20.25&date=2026-11-17&sky=rural&eq=eye");
    render(<App />);
    expect(window.location.search).toBe("");
    const params = new URLSearchParams(window.location.hash.slice(1));
    expect(params.get("lat")).toBe("10.5");
    expect(params.get("lon")).toBe("20.25");
    expect(params.get("sky")).toBe("rural");
  });

  it("reads a plan from the fragment", () => {
    window.history.replaceState(null, "", "/#lat=-33.9&lon=18.4&date=2026-11-17&sky=dark&eq=binoculars");
    render(<App />);
    expect(usePlan).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: -33.9, longitude: 18.4, sky: "dark", equipment: "binoculars" }),
      expect.any(String),
      expect.any(Boolean),
    );
  });

  it("loads a plan fragment that arrives while the page is open", () => {
    window.history.replaceState(null, "", "/#lat=10.5&lon=20.25&date=2026-11-17&sky=rural&eq=eye");
    render(<App />);
    // Opening another shared plan in the same tab, or going back or forward between plans, only
    // changes the fragment: the document is kept, so App must read the new plan itself.
    act(() => {
      window.history.pushState(null, "", "/#lat=-33.9&lon=18.4&date=2026-12-01&sky=dark&eq=binoculars");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(usePlan).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: -33.9,
        longitude: 18.4,
        date: "2026-12-01",
        sky: "dark",
        equipment: "binoculars",
      }),
      expect.any(String),
      expect.any(Boolean),
    );
    expect(new URLSearchParams(window.location.hash.slice(1)).get("lat")).toBe("-33.9");

    // An unrelated anchor afterwards puts back the plan now shown, not the first one.
    act(() => {
      window.history.pushState(null, "", "/#top");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(new URLSearchParams(window.location.hash.slice(1)).get("lat")).toBe("-33.9");
  });

  it("puts the plan back after an in-page link replaces the fragment", () => {
    window.history.replaceState(null, "", "/#lat=10.5&lon=20.25&date=2026-11-17&sky=rural&eq=eye");
    render(<App />);
    window.history.pushState(null, "", "/#top");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(new URLSearchParams(window.location.hash.slice(1)).get("lat")).toBe("10.5");
  });
});
