import React from "react";
import "./ResetPasswordModal.scss";

export default function ResetPasswordModal({ onClose, onBackToLogin }) {
  return (
    <div className="login-modal-backdrop">
      <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>
          ×
        </button>

        <h2 className="text-xl font-semibold mb-4">Reset Your Password</h2>
        <p className="reset-description">
          Enter your email linked to your account.
        </p>

        <input
          type="email"
          placeholder="E-mail"
          className="login-modal-input"
        />

        <button className="login-modal-btn">Send Reset Link</button>

        <h2 className="text-xl mt-4">Back to login</h2>
        <button className="login-modal-btn" onClick={onBackToLogin}>
          Login
        </button>
      </div>
    </div>
  );
}
