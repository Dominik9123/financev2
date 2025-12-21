import React, { useState } from "react";
import "./ResetPasswordModal.scss";
import { toast } from "react-toastify";

export default function ResetPasswordModal({ onClose, onBackToLogin }) {
  const [email, setEmail] = useState("");

  const handleResetRequest = async (e) => {
    e.preventDefault(); // To jest kluczowe, żeby strona się nie odświeżyła
    
    console.log("Próba wysłania resetu dla:", email); // Sprawdź to w konsoli (F12 -> Console)

    try {
      const response = await fetch("http://localhost:5109/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });

    if (response.ok) {
        toast.success("Reset link sent! Please check your Mailtrap inbox.", {
          position: "top-right",
          autoClose: 5000,
        });
        onClose(); 
      } else {
        toast.error("User not found or server error.");
      }
    } catch (error) {
      console.error("Błąd fetch:", error);
      toast.error("Connection error - check if backend is running!");
    }
};
  return (
    <div className="login-modal-backdrop">
      <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>×</button>

        <h2 className="text-xl font-semibold mb-4">Reset Your Password</h2>
        
        {/* FORMULARZ MUSI MIEĆ ONSUBMIT */}
        <form onSubmit={handleResetRequest}>
          <input
            type="email"
            placeholder="E-mail"
            className="login-modal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)} // To aktualizuje stan
            required
          />

          <button type="submit" className="login-modal-btn">
            Send Reset Link
          </button>
        </form>

        <h2 className="text-xl mt-4">Back to login</h2>
        <button className="login-modal-btn" onClick={onBackToLogin}>
          Login
        </button>
      </div>
    </div>
  );
}