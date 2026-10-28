import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import Navbar from "./Navbar";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("./LoginModal", () => () => null);
jest.mock("./ResetPasswordModal", () => () => null);
jest.mock("react-toastify", () => ({
  toast: { info: jest.fn(), error: jest.fn() },
}));

const storedData = {
  salaries: JSON.stringify([{ amount: 100, currency: "PLN", date: "2026-10-27" }]),
  expenses: JSON.stringify([{ amount: 25, currency: "PLN", category: "Food" }]),
  customCategories: JSON.stringify([{ name: "Books" }]),
  currency: "PLN (zł)",
  annualBudget: "12000",
  unrelatedPreference: "keep",
};

const originalFetch = global.fetch;

function SessionHarness() {
  const [user, setUser] = useState("Test User");
  return <Navbar user={user} setUser={setUser} />;
}

function expectStoredDataUnchanged() {
  expect(localStorage.length).toBe(Object.keys(storedData).length);
  Object.entries(storedData).forEach(([key, value]) => {
    expect(localStorage.getItem(key)).toBe(value);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  localStorage.clear();
  Object.entries(storedData).forEach(([key, value]) => localStorage.setItem(key, value));
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

test("confirmed logout switches to guest mode and preserves local data", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200 });
  render(<SessionHarness />);

  fireEvent.click(screen.getByText("Logout"));

  await screen.findByText("Login");
  expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:5109/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  expect(mockNavigate).toHaveBeenCalledWith("/");
  expect(toast.info).toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
  expectStoredDataUnchanged();
});

test("HTTP failure preserves the signed-in view and local data", async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 500 });
  render(<SessionHarness />);

  fireEvent.click(screen.getByText("Logout"));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    "Could not log out. Please try again."
  ));
  expect(screen.getByText("Test User")).toBeInTheDocument();
  expect(screen.getByText("Logout")).toBeInTheDocument();
  expect(screen.queryByText("Login")).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(toast.info).not.toHaveBeenCalled();
  expectStoredDataUnchanged();
});

test("network failure preserves the signed-in view and local data", async () => {
  global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
  jest.spyOn(console, "error").mockImplementation(() => {});
  render(<SessionHarness />);

  fireEvent.click(screen.getByText("Logout"));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    "Could not confirm logout. Check your connection and try again."
  ));
  expect(screen.getByText("Test User")).toBeInTheDocument();
  expect(screen.getByText("Logout")).toBeInTheDocument();
  expect(screen.queryByText("Login")).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(toast.info).not.toHaveBeenCalled();
  expectStoredDataUnchanged();
});

test("guest mode starts only after the server confirms logout", async () => {
  let confirmLogout;
  global.fetch.mockImplementation(() => new Promise(resolve => {
    confirmLogout = resolve;
  }));
  render(<SessionHarness />);

  fireEvent.click(screen.getByText("Logout"));

  expect(screen.getByText("Test User")).toBeInTheDocument();
  expect(screen.queryByText("Login")).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  expectStoredDataUnchanged();

  await act(async () => confirmLogout({ ok: true, status: 200 }));

  expect(screen.getByText("Login")).toBeInTheDocument();
  expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  expectStoredDataUnchanged();
});
