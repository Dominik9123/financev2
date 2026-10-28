import { act, renderHook, waitFor } from "@testing-library/react";
import { useTransactions } from "./useFinanceData";

const originalFetch = global.fetch;
const account = { id: "user-a", email: "test@example.test", firstName: "User", lastName: "" };
const response = data => ({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});
afterAll(() => { global.fetch = originalFetch; });

test("an old account response cannot overwrite guest data after logout", async () => {
  let finish;
  global.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  localStorage.setItem("salaries", JSON.stringify([{ amount: 10, currency: "PLN" }]));
  const { result, rerender } = renderHook(({ user }) => useTransactions(user), { initialProps: { user: account } });
  rerender({ user: null });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  await act(async () => finish(response([{ amount: 9000, type: "Income", currency: "PLN" }])));
  expect(result.current.data[0].amount).toBe(10);
  expect(result.current.error).toBe("");
});

test("a failed refresh can be retried without exposing guest data", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
  const { result } = renderHook(() => useTransactions(account));
  await waitFor(() => expect(result.current.error).not.toBe(""));
  expect(result.current.data).toEqual([]);
  global.fetch.mockResolvedValueOnce(response([{ id: 1, amount: 20, type: "Income", currency: "PLN" }]));
  await act(async () => { await result.current.reload(); });
  expect(result.current.error).toBe("");
  expect(result.current.data[0].amount).toBe(20);
});

test.each(["broken JSON", "{}", "[null]"])("damaged local storage (%s) shows an error and is preserved", async stored => {
  localStorage.setItem("salaries", stored);
  const { result } = renderHook(() => useTransactions(null));
  await waitFor(() => expect(result.current.error).toContain("has not been deleted"));
  expect(localStorage.getItem("salaries")).toBe(stored);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("an invalid API response becomes an error instead of an empty balance", async () => {
  global.fetch.mockResolvedValueOnce(response({ message: "unexpected" }));
  const { result } = renderHook(() => useTransactions(account));
  await waitFor(() => expect(result.current.error).not.toBe(""));
  expect(result.current.data).toEqual([]);
  expect(result.current.loading).toBe(false);
});

test("a refresh callback captured by a previous session cannot replace current data", async () => {
  global.fetch.mockResolvedValue(response([{ amount: 9000, type: "Income", currency: "PLN" }]));
  localStorage.setItem("salaries", JSON.stringify([{ amount: 10, currency: "PLN" }]));
  const { result, rerender } = renderHook(({ user }) => useTransactions(user), { initialProps: { user: account } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const oldReload = result.current.reload;
  rerender({ user: null });
  await waitFor(() => expect(result.current.data[0].amount).toBe(10));
  await act(async () => { await oldReload(); });
  expect(result.current.data[0].amount).toBe(10);
  expect(result.current.loading).toBe(false);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
