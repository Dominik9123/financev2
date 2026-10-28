import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import { fetchCurrencyRates } from "./services/currencyService";
import App from "./App";

jest.mock("react-chartjs-2", () => ({ Line: () => null, Bar: () => null }));
jest.mock("./components/ChartsRow", () => () => null);
jest.mock("./services/currencyService", () => ({ fetchCurrencyRates: jest.fn() }));
jest.mock("react-toastify", () => ({
  ToastContainer: () => null,
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const accountA = { id: "account-a", email: "anna-a@example.test", firstName: "Anna", lastName: "A" };
const accountB = { id: "account-b", email: "anna-b@example.test", firstName: "Anna", lastName: "B" };
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const originalFetch = global.fetch;
const originalDemoMode = process.env.REACT_APP_GUEST_DEMO;
let currentAccount;
let saveTransaction;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.REACT_APP_GUEST_DEMO;
  window.history.replaceState({}, "", "/financev2/");
  localStorage.clear();
  localStorage.setItem("currency", "PLN (zł)");
  localStorage.setItem("salaries", JSON.stringify([{ amount: 999, currency: "PLN", date: "2026-01-01" }]));
  localStorage.setItem("expenses", "[]");
  localStorage.setItem("customCategories", "[]");
  currentAccount = accountA;
  saveTransaction = jest.fn().mockResolvedValue(response(null, 401));
  fetchCurrencyRates.mockResolvedValue({ PLN: 1, USD: 4, EUR: 4.5, GBP: 5, JPY: 0.03 });
  global.fetch = jest.fn(async (url, options = {}) => {
    if (url.endsWith("/auth/me")) return response(currentAccount);
    if (url.endsWith("/auth/login")) return response(currentAccount);
    if (url.endsWith("/auth/logout")) return response(null);
    if (url.endsWith("/category")) return response([]);
    if (url.endsWith("/transaction") && options.method === "POST") return saveTransaction(options);
    if (url.endsWith("/transaction")) return response([{ id: 1, amount: currentAccount.id === accountA.id ? 10 : 50, currency: "PLN", type: "Income", date: "2026-01-01" }]);
    throw new Error("Unexpected test request.");
  });
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalDemoMode === undefined) delete process.env.REACT_APP_GUEST_DEMO;
  else process.env.REACT_APP_GUEST_DEMO = originalDemoMode;
});

async function openAccountDashboard() {
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Payout" })).toBeEnabled());
}

async function expireSessionWithIncome() {
  fireEvent.change(screen.getByLabelText("Salary amount"), { target: { value: "123.45" } });
  fireEvent.change(screen.getByLabelText("Income date"), { target: { value: "2026-10-28" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));
  await screen.findByText(/Your session has expired\. Use Login/);
}

function submitLogin() {
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: currentAccount.email } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "ValidPass1!" } });
  fireEvent.submit(screen.getByRole("form", { name: "Login" }));
}

test("an expired session preserves a draft and restores it only for the same account", async () => {
  await openAccountDashboard();
  await expireSessionWithIncome();
  expect(screen.getByLabelText("Salary amount")).toHaveValue(123.45);
  expect(screen.getByRole("button", { name: "Add Payout" })).toBeDisabled();
  expect(screen.queryByText("(zł) 999.00")).not.toBeInTheDocument();
  submitLogin();
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Payout" })).toBeEnabled());
  expect(screen.getByLabelText("Salary amount")).toHaveValue(123.45);
  expect(screen.getByLabelText("Income date")).toHaveValue("2026-10-28");
  expect(saveTransaction).toHaveBeenCalledTimes(1);
});

test("logging in to a different account with the same first name clears the previous draft and data", async () => {
  await openAccountDashboard();
  await expireSessionWithIncome();
  currentAccount = accountB;
  submitLogin();
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Payout" })).toBeEnabled());
  expect(screen.getByLabelText("Salary amount")).toHaveValue(null);
  expect(screen.getByLabelText("Income date")).toHaveValue("");
  expect(screen.getByText("(zł) 50.00")).toBeInTheDocument();
  expect(screen.queryByText("(zł) 10.00")).not.toBeInTheDocument();
  expect(screen.queryByText("(zł) 999.00")).not.toBeInTheDocument();
});

test("a confirmed logout loads preserved guest data and clears the account draft", async () => {
  await openAccountDashboard();
  fireEvent.change(screen.getByLabelText("Salary amount"), { target: { value: "123.45" } });
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  await screen.findByText("(zł) 999.00");
  expect(screen.getByLabelText("Salary amount")).toHaveValue(null);
  expect(screen.queryByText("(zł) 10.00")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("salaries"))[0].amount).toBe(999);
});

test("a delayed expense batch stops after logout and cannot write into guest data", async () => {
  let finish;
  saveTransaction.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await openAccountDashboard();
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Expense" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Housing amount"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Food amount"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  await screen.findByText("(zł) 999.00");
  await act(async () => finish(response(null)));
  expect(saveTransaction).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("expenses")).toBe("[]");
  expect(screen.getByLabelText("Housing amount")).toHaveValue(null);
});

test("an HTTP 500 save failure preserves the account session and input", async () => {
  saveTransaction.mockResolvedValue(response(null, 500));
  await openAccountDashboard();
  fireEvent.change(screen.getByLabelText("Salary amount"), { target: { value: "123.45" } });
  fireEvent.change(screen.getByLabelText("Income date"), { target: { value: "2026-10-28" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  expect(screen.getByLabelText("Salary amount")).toHaveValue(123.45);
  expect(screen.queryByText(/Your session has expired\. Use Login/)).not.toBeInTheDocument();
});

test("an expired read request asks for login without loading guest records", async () => {
  const normalFetch = global.fetch;
  global.fetch = jest.fn((url, options) => url.endsWith("/transaction")
    ? Promise.resolve(response(null, 401))
    : normalFetch(url, options));
  render(<App />);
  await screen.findByText(/Your session has expired\. Use Login/);
  expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Payout" })).toBeDisabled();
  expect(screen.queryByText("(zł) 999.00")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("salaries"))[0].amount).toBe(999);
});

test("a delayed 401 from before reauthentication cannot expire the restored session", async () => {
  let finishCategory;
  let finishSave;
  const normalFetch = global.fetch;
  let categoryCalls = 0;
  global.fetch = jest.fn((url, options) => {
    if (url.endsWith("/category") && categoryCalls++ === 0) {
      return new Promise(resolve => { finishCategory = resolve; });
    }
    return normalFetch(url, options);
  });
  saveTransaction.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
  await openAccountDashboard();
  fireEvent.change(screen.getByLabelText("Salary amount"), { target: { value: "123.45" } });
  fireEvent.change(screen.getByLabelText("Income date"), { target: { value: "2026-10-28" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));
  await act(async () => finishCategory(response(null, 401)));
  await screen.findByText(/Your session has expired\. Use Login/);
  submitLogin();
  await screen.findByRole("button", { name: "Logout" });
  await act(async () => finishSave(response(null, 401)));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Payout" })).toBeEnabled());
  expect(screen.queryByText(/Your session has expired\. Use Login/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Salary amount")).toHaveValue(123.45);
});

test("a delayed confirmed save refreshes the same account after reauthentication", async () => {
  let finishCategory;
  let finishSave;
  let categoryCalls = 0;
  let income = 10;
  const normalFetch = global.fetch;
  global.fetch = jest.fn((url, options = {}) => {
    if (url.endsWith("/category") && categoryCalls++ === 0) return new Promise(resolve => { finishCategory = resolve; });
    if (url.endsWith("/transaction") && options.method !== "POST") {
      return Promise.resolve(response([{ id: 1, amount: income, currency: "PLN", type: "Income", date: "2026-01-01" }]));
    }
    return normalFetch(url, options);
  });
  saveTransaction.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
  await openAccountDashboard();
  fireEvent.change(screen.getByLabelText("Salary amount"), { target: { value: "123.45" } });
  fireEvent.change(screen.getByLabelText("Income date"), { target: { value: "2026-10-28" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Payout" }));
  await act(async () => finishCategory(response(null, 401)));
  await screen.findByText(/Your session has expired\. Use Login/);
  submitLogin();
  await screen.findByRole("button", { name: "Logout" });
  income = 133.45;
  await act(async () => finishSave(response(null)));
  await screen.findByText("(zł) 133.45");
  expect(screen.getByLabelText("Salary amount")).toHaveValue(null);
});
