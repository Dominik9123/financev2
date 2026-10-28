import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

// Exercise session initialization and real router navigation independently of page data.
jest.mock("./pages/Dashboard", () => () => <h1>Dashboard page</h1>);
jest.mock("./pages/History", () => () => <h1>History page</h1>);
jest.mock("./pages/Settings", () => () => <h1>Settings page</h1>);

const originalFetch = global.fetch;

beforeEach(() => {
  window.history.replaceState({}, "", "/financev2/");
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
});
afterAll(() => { global.fetch = originalFetch; });

test("an unauthenticated visitor reaches the guest dashboard", async () => {
  render(<App />);
  expect(screen.getByText("Loading...")).toBeInTheDocument();
  await screen.findByRole("heading", { name: "Dashboard page" });
  expect(screen.getByText("Login")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:5109/api/auth/me", expect.objectContaining({
    credentials: "include", method: "GET",
  }));
});

test("a restored account session shows the signed-in navbar", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ firstName: "Test User" }) });
  render(<App />);
  await screen.findByText("Test User");
  expect(screen.getByText("Logout")).toBeInTheDocument();
  expect(screen.queryByText("Login")).not.toBeInTheDocument();
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
