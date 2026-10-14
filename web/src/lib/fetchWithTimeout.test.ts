import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetchWithTimeout";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("bounded admin requests", () => {
  it("aborts an unresponsive request instead of leaving loading indefinite", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            requestSignal = init.signal;
            init.signal.addEventListener("abort", () =>
              reject(init.signal.reason),
            );
          }),
      ),
    );
    const result = fetchWithTimeout("/api/admin/jobs", {}, 20);
    const rejected = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(requestSignal?.aborted).toBe(true);
  });
  it("retains caller cancellation and clears the timeout on success", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await fetchWithTimeout("/api/admin/jobs");
    expect(vi.getTimerCount()).toBe(0);
    const source = new AbortController();
    source.abort();
    await fetchWithTimeout("/api/admin/jobs", { signal: source.signal });
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true);
  });
});
