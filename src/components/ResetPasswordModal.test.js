import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import ResetPasswordModal from "./ResetPasswordModal";

jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});
afterAll(() => { global.fetch = originalFetch; });

function requestReset() {
  const onClose = jest.fn();
  render(<ResetPasswordModal onClose={onClose} onBackToLogin={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: "anna@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
  return onClose;
}

test("an accepted reset request displays the generic message and closes the modal", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200 });
  const onClose = requestReset();
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(toast.success).toHaveBeenCalledWith("If an account with this email exists, reset instructions have been sent.");
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:5109/api/auth/forgot-password", expect.objectContaining({
    method: "POST", body: JSON.stringify({ email: "anna@example.test" }),
  }));
});

test.each([500, "network"])("a failed reset request (%s) keeps the email and modal open", async failure => {
  if (failure === "network") global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
  else global.fetch.mockResolvedValue({ ok: false, status: failure });
  const onClose = requestReset();
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("E-mail")).toHaveValue("anna@example.test");
  expect(toast.success).not.toHaveBeenCalled();
});

test.each([500, "network"])("a pending request blocks duplicate submits and permits retry after %s", async failure => {
  let finish;
  let fail;
  global.fetch.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  })).mockResolvedValue({ ok: true, status: 200 });
  const onClose = jest.fn();
  const onBackToLogin = jest.fn();
  render(<ResetPasswordModal onClose={onClose} onBackToLogin={onBackToLogin} />);
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: "anna@example.test" } });
  const form = screen.getByRole("form", { name: "Password reset request" });
  fireEvent.submit(form);
  fireEvent.submit(form);

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  expect(screen.getByPlaceholderText("E-mail")).toBeDisabled();
  const close = screen.getByRole("button", { name: "×" });
  const back = screen.getByRole("button", { name: "Login" });
  expect(close).toBeDisabled();
  expect(back).toBeDisabled();
  fireEvent.click(close);
  fireEvent.click(back);
  expect(onClose).not.toHaveBeenCalled();
  expect(onBackToLogin).not.toHaveBeenCalled();

  await act(async () => {
    if (failure === "network") fail(new TypeError("Failed to fetch"));
    else finish({ ok: false, status: failure });
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeEnabled());
  expect(screen.getByPlaceholderText("E-mail")).toHaveValue("anna@example.test");
  expect(screen.getByPlaceholderText("E-mail")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
