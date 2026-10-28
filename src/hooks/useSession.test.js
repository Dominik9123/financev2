import { act, renderHook, waitFor } from "@testing-library/react";
import { useSession } from "./useSession";

const accountA = { id: "a", email: "a@example.test", firstName: "Anna", lastName: "" };
const accountB = { id: "b", email: "b@example.test", firstName: "Anna", lastName: "" };
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.useRealTimers(); });
afterAll(() => { global.fetch = originalFetch; });

test("a late session check cannot overwrite a newer login", async () => {
  let finish;
  global.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useSession());
  await act(async () => result.current.setUser(accountB));
  await act(async () => finish({ ok: true, status: 200, json: async () => accountA }));
  expect(result.current.status).toBe("authenticated");
  expect(result.current.user.id).toBe("b");
});

test("an old account's expired request cannot expire a newer login", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => accountA });
  const { result } = renderHook(() => useSession());
  await waitFor(() => expect(result.current.status).toBe("authenticated"));
  await act(async () => result.current.setUser(accountB));
  await act(async () => result.current.expireSession(accountA.id));
  expect(result.current.status).toBe("authenticated");
  expect(result.current.user.id).toBe(accountB.id);
});

test("a stalled session request times out instead of leaving the app loading forever", async () => {
  jest.useFakeTimers();
  global.fetch.mockImplementation((_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const { result } = renderHook(() => useSession());
  expect(result.current.status).toBe("checking");
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(result.current.status).toBe("unavailable");
  expect(result.current.user).toBeNull();
});
