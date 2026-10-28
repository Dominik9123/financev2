import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import LoginModal from "./LoginModal";

jest.mock("react-toastify", () => ({
  toast: { warning: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});
afterAll(() => { global.fetch = originalFetch; });

function openRegistration(password = "ValidPass1!") {
  render(<LoginModal onClose={jest.fn()} onReset={jest.fn()} setUser={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
  for (const [placeholder, value] of [
    ["First Name", "Anna"], ["Last Name", "Kowalska"], ["E-mail", "anna@example.test"],
    ["Password", password], ["Confirm Password", password],
  ]) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
  }
}

function submitRegistration() {
  fireEvent.submit(screen.getByRole("form", { name: "Registration" }));
}

test.each(["1234", "abcdefgh1!", "Abcdefgh!", "Abcdefgh1"])("registration rejects a weak password before contacting the API", password => {
  openRegistration(password);
  submitRegistration();
  expect(toast.warning).toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("registration rejects a whitespace-only name", () => {
  openRegistration();
  fireEvent.change(screen.getByPlaceholderText("First Name"), { target: { value: "   " } });
  submitRegistration();
  expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("first and last name"));
  expect(global.fetch).not.toHaveBeenCalled();
});

test("registration displays field validation errors and preserves the form", async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ errors: { Email: ["Enter a valid email address."] } }) });
  openRegistration();
  submitRegistration();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Enter a valid email address."));
  expect(screen.getByPlaceholderText("First Name")).toHaveValue("Anna");
  expect(screen.getByPlaceholderText("Password")).toHaveValue("ValidPass1!");
  expect(toast.info).not.toHaveBeenCalled();
});

test("registration displays Identity errors such as a duplicate email", async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => [{ code: "DuplicateEmail", description: "Email is already taken." }] });
  openRegistration();
  submitRegistration();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email is already taken."));
});

test("successful registration sends trimmed names and moves to login", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200 });
  openRegistration();
  fireEvent.change(screen.getByPlaceholderText("First Name"), { target: { value: " Anna " } });
  submitRegistration();
  await screen.findByRole("heading", { name: "Welcome Again!" });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe("http://localhost:5109/api/auth/register");
  expect(JSON.parse(options.body)).toEqual({ firstName: "Anna", lastName: "Kowalska", email: "anna@example.test", password: "ValidPass1!" });
  expect(toast.info).toHaveBeenCalled();
});

test("password reset rejects weak passwords before contacting the API", () => {
  render(<LoginModal onClose={jest.fn()} initialResetData={{ email: "anna@example.test", token: "token" }} />);
  fireEvent.change(screen.getByPlaceholderText("New Password"), { target: { value: "1234" } });
  fireEvent.change(screen.getByPlaceholderText("Confirm New Password"), { target: { value: "1234" } });
  fireEvent.submit(screen.getByRole("form", { name: "Set new password" }));
  expect(toast.warning).toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});
