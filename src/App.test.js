import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

// Exercise session initialization and real router navigation independently of page data.
jest.mock("./pages/Dashboard", () => () => <h1>Dashboard page</h1>);
jest.mock("./pages/History", () => () => <h1>History page</h1>);
jest.mock("./pages/Settings", () => () => <h1>Settings page</h1>);

const originalFetch = global.fetch;
const originalDemoMode = process.env.REACT_APP_GUEST_DEMO;
const account = { id: "user-a", email: "test@example.test", firstName: "Test User", lastName: "" };

beforeEach(() => {
  delete process.env.REACT_APP_GUEST_DEMO;
  window.history.replaceState({}, "", "/financev2/");
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
});
afterAll(() => {
  global.fetch = originalFetch;
  if (originalDemoMode === undefined) delete process.env.REACT_APP_GUEST_DEMO;
  else process.env.REACT_APP_GUEST_DEMO = originalDemoMode;
});

test("an unauthenticated visitor reaches the guest dashboard", async () => {
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent("Checking session");
  await screen.findByRole("heading", { name: "Dashboard page" });
  expect(screen.getByText("Login")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:5109/api/auth/me", expect.objectContaining({
    credentials: "include", method: "GET",
  }));
});

test("a restored account session shows the signed-in navbar", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => account });
  render(<App />);
  await screen.findByText("Test User");
  expect(screen.getByText("Logout")).toBeInTheDocument();
  expect(screen.queryByText("Login")).not.toBeInTheDocument();
});

test.each([500, 403, "network", "invalid"])("a session check failure (%s) does not automatically load guest data", async failure => {
  if (failure === "network") global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
  else if (failure === "invalid") global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ firstName: "Missing ID" }) });
  else global.fetch.mockResolvedValue({ ok: false, status: failure });
  render(<App />);
  await screen.findByRole("heading", { name: "Could not verify your session" });
  expect(screen.queryByRole("heading", { name: "Dashboard page" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue as guest" }));
  expect(screen.getByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();
});

test("a failed session check can be retried", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
  render(<App />);
  await screen.findByRole("heading", { name: "Could not verify your session" });
  global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => account });
  fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
  await screen.findByText("Test User");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("an account without a first name is still signed in and displays its email", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...account, firstName: "" }) });
  render(<App />);
  await screen.findByText(account.email);
  expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
});

test("the GitHub Pages guest build does not contact the backend", async () => {
  process.env.REACT_APP_GUEST_DEMO = "true";
  render(<App />);
  expect(screen.getByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();
  expect(screen.getByText("Guest demo")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Login" })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("logging in from history preserves the current route", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard page" });
  fireEvent.click(screen.getByRole("link", { name: /History/i }));
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => account });
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: account.email } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "ValidPass1!" } });
  fireEvent.submit(screen.getByRole("form", { name: "Login" }));
  await screen.findByRole("button", { name: "Logout" });
  expect(window.location.pathname).toBe("/financev2/history");
  expect(screen.getByRole("heading", { name: "History page" })).toBeInTheDocument();
});

test("navbar links navigate within the GitHub Pages base path", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard page" });
  fireEvent.click(screen.getByRole("link", { name: /History/i }));
  await screen.findByRole("heading", { name: "History page" });
  expect(window.location.pathname).toBe("/financev2/history");
  fireEvent.click(screen.getByRole("link", { name: /Settings/i }));
  await screen.findByRole("heading", { name: "Settings page" });
  expect(window.location.pathname).toBe("/financev2/settings");
});
