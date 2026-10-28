import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import LoginModal from "./LoginModal";

jest.mock("react-toastify", () => ({
  toast: { warning: jest.fn(), error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  window.history.replaceState({}, "", "/financev2/");
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

function fillLogin() {
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: "anna@example.test" } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "ValidPass1!" } });
}

test("login stores the complete validated account instead of its first name", async () => {
  const account = { id: "account-a", email: "anna@example.test", firstName: "Anna", lastName: "User" };
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => account });
  const setUser = jest.fn();
  const onClose = jest.fn();
  render(<LoginModal onClose={onClose} setUser={setUser} />);
  fillLogin();
  fireEvent.submit(screen.getByRole("form", { name: "Login" }));
  await waitFor(() => expect(setUser).toHaveBeenCalledWith(account));
  expect(onClose).toHaveBeenCalled();
});

test.each([401, 500, "invalid"])("a failed or invalid login response (%s) keeps the form and session unchanged", async failure => {
  global.fetch.mockResolvedValue(failure === "invalid"
    ? { ok: true, status: 200, json: async () => ({ firstName: "Missing ID" }) }
    : { ok: false, status: failure });
  const setUser = jest.fn();
  const onClose = jest.fn();
  render(<LoginModal onClose={onClose} setUser={setUser} />);
  fillLogin();
  fireEvent.submit(screen.getByRole("form", { name: "Login" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(setUser).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("E-mail")).toHaveValue("anna@example.test");
  expect(screen.getByPlaceholderText("Password")).toHaveValue("ValidPass1!");
});

test("a pending login cannot be submitted twice", async () => {
  let finish;
  global.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<LoginModal onClose={jest.fn()} setUser={jest.fn()} />);
  fillLogin();
  const form = screen.getByRole("form", { name: "Login" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
  await act(async () => finish({ ok: false, status: 401 }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Login" })).toBeEnabled());
});

function openPasswordReset() {
  const onClose = jest.fn();
  window.history.replaceState({}, "", "/financev2/?token=test-token&email=anna%40example.test");
  render(<LoginModal onClose={onClose} initialResetData={{ email: "anna@example.test", token: "test-token" }} />);
  fireEvent.change(screen.getByPlaceholderText("New Password"), { target: { value: "NewValidPass2!" } });
  fireEvent.change(screen.getByPlaceholderText("Confirm New Password"), { target: { value: "NewValidPass2!" } });
  return onClose;
}

test("an invalid reset link displays the server error and preserves the form", async () => {
  const message = "This reset link is invalid, expired or has already been used. Request a new link.";
  global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ errors: { Token: [message] } }) });
  const onClose = openPasswordReset();
  fireEvent.submit(screen.getByRole("form", { name: "Set new password" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(screen.getByPlaceholderText("New Password")).toHaveValue("NewValidPass2!");
  expect(screen.getByPlaceholderText("Confirm New Password")).toHaveValue("NewValidPass2!");
  expect(window.location.search).toContain("token=test-token");
  expect(onClose).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

test("a successful reset clears URL parameters and shows login with an empty password", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200 });
  const onClose = openPasswordReset();
  fireEvent.submit(screen.getByRole("form", { name: "Set new password" }));
  await screen.findByRole("heading", { name: "Welcome Again!" });
  expect(screen.getByPlaceholderText("Password")).toHaveValue("");
  expect(window.location.search).toBe("");
  expect(window.location.pathname).toBe("/financev2/");
  expect(toast.success).toHaveBeenCalledWith("Password changed. You can now log in.");
  expect(onClose).not.toHaveBeenCalled();
});

test("a reset connection failure preserves the input instead of reporting success", async () => {
  global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
  openPasswordReset();
  fireEvent.submit(screen.getByRole("form", { name: "Set new password" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Cannot connect")));
  expect(screen.getByPlaceholderText("New Password")).toHaveValue("NewValidPass2!");
  expect(toast.success).not.toHaveBeenCalled();
});

test.each([400, "network"])("a pending password update blocks duplicate submits and permits retry after %s", async failure => {
  let finish;
  let fail;
  global.fetch.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  })).mockResolvedValue({ ok: true, status: 200 });
  const onClose = openPasswordReset();
  const form = screen.getByRole("form", { name: "Set new password" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();
  expect(screen.getByPlaceholderText("New Password")).toBeDisabled();
  expect(screen.getByPlaceholderText("Confirm New Password")).toBeDisabled();
  const close = screen.getByRole("button", { name: "×" });
  const cancel = screen.getByRole("button", { name: "Cancel" });
  expect(close).toBeDisabled();
  expect(cancel).toBeDisabled();
  fireEvent.click(close);
  fireEvent.click(cancel);
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Set New Password" })).toBeInTheDocument();

  await act(async () => {
    if (failure === "network") fail(new TypeError("Failed to fetch"));
    else finish({ ok: false, status: failure, json: async () => ({ errors: { Token: ["Invalid reset link."] } }) });
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Update Password" })).toBeEnabled());
  expect(screen.getByPlaceholderText("New Password")).toHaveValue("NewValidPass2!");
  expect(screen.getByPlaceholderText("New Password")).toBeEnabled();
  expect(screen.getByRole("button", { name: "×" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  fireEvent.submit(form);
  await screen.findByRole("heading", { name: "Welcome Again!" });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
