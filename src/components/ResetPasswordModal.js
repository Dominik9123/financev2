import React, { useRef, useState } from "react";
import "./ResetPasswordModal.scss";
import { toast } from "react-toastify";
import { apiErrorMessage, postJson } from "../services/financeApi";

export default function ResetPasswordModal({ onClose, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const resetPending = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const handleResetRequest = async (e) => {
    e.preventDefault();

    if (resetPending.current) return;

    resetPending.current = true;
    setIsSending(true);

    try {
      await postJson("/auth/forgot-password", {
        email: email.trim()
      });

      toast.success(
        "If an account with this email exists, reset instructions have been sent."
      );

      onClose();
    } catch (error) {
      toast.error(
        apiErrorMessage(
          error,
          "Could not process the password reset request. Please try again."
        )
      );
    } finally {
      resetPending.current = false;
      setIsSending(false);
    }
  };

  return (
    <div className="login-modal-backdrop">
      <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} disabled={isSending}>×</button>

        <h2 className="text-xl font-semibold mb-4">Reset Your Password</h2>
        
        {/* FORMULARZ MUSI MIEĆ ONSUBMIT */}
        <form onSubmit={handleResetRequest} aria-label="Password reset request">
          <input
            type="email"
            placeholder="E-mail"
            className="login-modal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)} 
            disabled={isSending}
            required
          />

          <button type="submit" className="login-modal-btn" disabled={isSending}>
            {isSending ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <h2 className="text-xl mt-4">Back to login</h2>
        <button className="login-modal-btn" onClick={onBackToLogin} disabled={isSending}>
          Login
        </button>
      </div>
    </div>
  );
}
