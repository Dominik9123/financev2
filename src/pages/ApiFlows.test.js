import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import { fetchCurrencyRates } from "../services/currencyService";
import Dashboard from "./Dashboard";
import History from "./History";
import Settings from "./Settings";

jest.mock("react-chartjs-2", () => ({ Line: () => null, Bar: () => null }));
jest.mock("../components/ChartsRow", () => () => null);
jest.mock("../services/currencyService", () => ({ fetchCurrencyRates: jest.fn() }));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const originalFetch = global.fetch;
const account = { id: "user-a", email: "test@example.test", firstName: "User", lastName: "" };
const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(data),
});
let accountTransactions;
let accountCategories;
let mutate;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("currency", "PLN (zł)");
  localStorage.setItem("salaries", JSON.stringify([{ amount: 999, currency: "PLN", date: "2026-01-01" }]));
  localStorage.setItem("expenses", "[]");
  localStorage.setItem("customCategories", JSON.stringify([{ name: "Guest only" }]));
  fetchCurrencyRates.mockResolvedValue({ PLN: 1, USD: 4, EUR: 4.5, GBP: 5, JPY: 0.03 });
  accountTransactions = [];
  accountCategories = [{ id: 1, name: "Account only" }];
  mutate = jest.fn().mockResolvedValue(response(undefined, 500));
  global.fetch = jest.fn((url, options = {}) => {
    if (!options.method || options.method === "GET") {
      if (url.endsWith("/transaction")) return Promise.resolve(response(accountTransactions));
      if (url.endsWith("/category")) return Promise.resolve(response(accountCategories));
    }
    return mutate(url, options);
  });
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => { global.fetch = originalFetch; });

async function openDashboard() {
  render(<Dashboard user={account} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Payout" })).toBeEnabled());
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Expense" })).toBeEnabled());
}

async function openSettings(user = account) {
  render(<Settings user={user} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Add Category/ })).toBeEnabled());
}

function fillIncome() {
  fireEvent.change(screen.getByLabelText("Salary amount"), { target: { value: "123.45" } });
  fireEvent.change(screen.getByLabelText("Income date"), { target: { value: "2026-10-28" } });
}

test.each([
  [400, "Could not save income"],
  [401, "session has expired"],
  [500, "Could not save income"],
  ["network", "Cannot connect"],
])("income failure (%s) preserves inputs and guest data", async (failure, message) => {
  if (failure === "network") mutate.mockRejectedValue(new TypeError("Failed to fetch"));
  else mutate.mockResolvedValue(response(undefined, failure));
  await openDashboard();
  const saved = localStorage.getItem("salaries");
  fillIncome();
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByLabelText("Salary amount")).toHaveValue(123.45);
  expect(screen.getByLabelText("Income date")).toHaveValue("2026-10-28");
  expect(localStorage.getItem("salaries")).toBe(saved);
  expect(toast.success).not.toHaveBeenCalled();
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining(message));
});

test("confirmed income save accepts an empty body, clears inputs and refreshes balance", async () => {
  const savedResponse = response(undefined, 204);
  mutate.mockImplementation(async (_, options) => {
    accountTransactions = [{ id: 1, ...JSON.parse(options.body) }];
    return savedResponse;
  });
  await openDashboard();
  fillIncome();
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));

  await waitFor(() => expect(screen.getByLabelText("Salary amount")).toHaveValue(null));
  await screen.findByText("(zł) 123.45");
  expect(savedResponse.json).not.toHaveBeenCalled();
  expect(mutate).toHaveBeenCalledWith(expect.stringContaining("/transaction"), expect.objectContaining({
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
  }));
});

test("a pending income request cannot be submitted twice", async () => {
  let finish;
  mutate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await openDashboard();
  fillIncome();
  const button = screen.getByRole("button", { name: "Add Payout" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByLabelText("Salary amount")).toBeDisabled();
  expect(mutate).toHaveBeenCalledTimes(1);
  await act(async () => finish(response(undefined, 500)));
  await waitFor(() => expect(button).toBeEnabled());
});

test("a partial expense batch preserves failed and unattempted amounts and retries only those", async () => {
  let calls = 0;
  mutate.mockImplementation(async (_, options) => {
    calls += 1;
    if (calls === 2) return response(undefined, 500);
    accountTransactions = [...accountTransactions, { id: calls, ...JSON.parse(options.body) }];
    return response(undefined);
  });
  await openDashboard();
  for (const [category, amount] of [["Housing", "10"], ["Food", "20"], ["Transport", "30"]]) {
    fireEvent.change(screen.getByLabelText(`${category} amount`), { target: { value: amount } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("1 expense(s) saved")));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Expense" })).toBeEnabled());
  expect(screen.getByLabelText("Housing amount")).toHaveValue(null);
  expect(screen.getByLabelText("Food amount")).toHaveValue(20);
  expect(screen.getByLabelText("Transport amount")).toHaveValue(30);
  expect(toast.success).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Expenses saved successfully."));
  expect(mutate.mock.calls.map(([, options]) => JSON.parse(options.body).category))
    .toEqual(["Housing", "Food", "Food", "Transport"]);
  expect(accountTransactions.map(t => t.amount)).toEqual([10, 20, 30]);
});

test("invalid expense amounts never reach the API", async () => {
  await openDashboard();
  fireEvent.change(screen.getByLabelText("Food amount"), { target: { value: "-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));
  expect(toast.error).toHaveBeenCalled();
  expect(mutate).not.toHaveBeenCalled();
});

test.each([Dashboard, History, Settings])("%p does not show guest records after an account read failure", async Page => {
  global.fetch.mockResolvedValue(response(undefined, 401));
  const read = jest.spyOn(Storage.prototype, "getItem");
  render(<Page user={account} />);
  await screen.findAllByText("Your session has expired. Please log in again.");
  expect(screen.queryByText("Guest only")).not.toBeInTheDocument();
  expect(read.mock.calls.flat()).not.toEqual(expect.arrayContaining(["salaries"]));
  expect(read.mock.calls.flat()).not.toEqual(expect.arrayContaining(["expenses"]));
  expect(read.mock.calls.flat()).not.toEqual(expect.arrayContaining(["customCategories"]));
  expect(screen.queryByText("(zł) 999.00")).not.toBeInTheDocument();
});

test.each([500, "network"])("failed category creation (%s) keeps the form and does not save locally", async failure => {
  if (failure === "network") mutate.mockRejectedValue(new TypeError("Failed to fetch"));
  else mutate.mockResolvedValue(response(undefined, failure));
  await openSettings();
  const guestCategories = localStorage.getItem("customCategories");
  fireEvent.change(screen.getByLabelText("New category"), { target: { value: "Books" } });
  fireEvent.click(screen.getByRole("button", { name: /Add Category/ }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByLabelText("New category")).toHaveValue("Books");
  expect(localStorage.getItem("customCategories")).toBe(guestCategories);
  expect(toast.success).not.toHaveBeenCalled();
});

test("failed category deletion keeps the category and guest storage", async () => {
  await openSettings();
  const guestCategories = localStorage.getItem("customCategories");
  fireEvent.click(screen.getByRole("button", { name: "Delete Account only" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByText("Account only")).toBeInTheDocument();
  expect(localStorage.getItem("customCategories")).toBe(guestCategories);
  expect(toast.success).not.toHaveBeenCalled();
});

test.each([401, 500, "network"])("failed account reset (%s) keeps the dialog and guest transactions", async failure => {
  if (failure === "network") mutate.mockRejectedValue(new TypeError("Failed to fetch"));
  else mutate.mockResolvedValue(response(undefined, failure));
  await openSettings();
  const salaries = localStorage.getItem("salaries");
  fireEvent.click(screen.getByRole("button", { name: /Reset Account Data/ }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, Delete Everything" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(localStorage.getItem("salaries")).toBe(salaries);
  expect(localStorage.getItem("expenses")).toBe("[]");
  expect(screen.getByText("Confirm Reset ⚠️")).toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
});

test("successful account reset preserves guest transactions and closes the dialog", async () => {
  mutate.mockResolvedValue(response(undefined));
  await openSettings();
  const salaries = localStorage.getItem("salaries");
  fireEvent.click(screen.getByRole("button", { name: /Reset Account Data/ }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, Delete Everything" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(localStorage.getItem("salaries")).toBe(salaries);
  expect(localStorage.getItem("expenses")).toBe("[]");
  expect(screen.queryByText("Confirm Reset ⚠️")).not.toBeInTheDocument();
});

test("guest reset removes only local transactions", async () => {
  await openSettings(null);
  fireEvent.click(screen.getByRole("button", { name: /Reset Local Data/ }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, Delete Everything" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(localStorage.getItem("salaries")).toBeNull();
  expect(localStorage.getItem("expenses")).toBeNull();
  expect(localStorage.getItem("customCategories")).not.toBeNull();
  expect(localStorage.getItem("currency")).toBe("PLN (zł)");
  expect(mutate).not.toHaveBeenCalled();
});

test("guest income and category writes stay local", async () => {
  const view = render(<Dashboard user={null} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Payout" })).toBeEnabled());
  fillIncome();
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem("salaries"))).toHaveLength(2));
  view.unmount();
  await openSettings(null);
  fireEvent.change(screen.getByLabelText("New category"), { target: { value: " Books " } });
  fireEvent.click(screen.getByRole("button", { name: /Add Category/ }));
  await screen.findByText("Books");
  expect(JSON.parse(localStorage.getItem("customCategories"))).toContainEqual({ name: "Books" });
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each(["10.123", "1000000000.01"])("invalid expense precision or range (%s) preserves the input", async amount => {
  await openDashboard();
  fireEvent.change(screen.getByLabelText("Food amount"), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("two decimal places"));
  expect(screen.getByLabelText("Food amount")).toHaveValue(Number(amount));
  expect(mutate).not.toHaveBeenCalled();
});

test("a category conflict displays the backend message and keeps the name", async () => {
  mutate.mockResolvedValue(response({ errors: { Name: ["This category already exists."] } }, 409));
  await openSettings();
  fireEvent.change(screen.getByLabelText("New category"), { target: { value: "Books" } });
  fireEvent.click(screen.getByRole("button", { name: /Add Category/ }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This category already exists.", expect.any(Object)));
  expect(screen.getByLabelText("New category")).toHaveValue("Books");
  expect(toast.success).not.toHaveBeenCalled();
});

test.each([" food ", "Income", "All"])("guest mode cannot create a default or reserved category (%s)", async name => {
  await openSettings(null);
  const stored = localStorage.getItem("customCategories");
  fireEvent.change(screen.getByLabelText("New category"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: /Add Category/ }));
  expect(toast.warning).toHaveBeenCalledWith("This category already exists.", expect.any(Object));
  expect(localStorage.getItem("customCategories")).toBe(stored);
  expect(global.fetch).not.toHaveBeenCalled();
});
