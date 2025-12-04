import React from "react";
import "./LoginModal.scss";

export default function LoginModal({ onClose, onReset }) {
  const [isRegister, setIsRegister] = React.useState(false);

  return (
    <div className="login-modal-backdrop" /*onClick={onClose} */>
      <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>
          ×
        </button>

        {!isRegister ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Welcome Again!</h2>

            <input
              type="email"
              placeholder="E-mail"
              className="login-modal-input"
            />

            <input
              type="password"
              placeholder="Password"
              className="login-modal-input"
            />

            <button className="login-modal-btn">Login</button>

            <h2 className="text-xl mt-4">Forgot your Password?</h2>
            <button className="login-modal-btn" onClick={onReset}>
            Reset Password
            </button>

            <h2 className="text-xl">New here?</h2>
            <button className="login-modal-btn" onClick={() => setIsRegister(true)}>
            Register
            </button>

          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Create an Account</h2>

            <input
              type="text"
              placeholder="First Name"
              className="login-modal-input"
            />

            <input
              type="text"
              placeholder="Last Name"
              className="login-modal-input"
            />

            <input
              type="email"
              placeholder="E-mail"
              className="login-modal-input"
            />

            <input
              type="password"
              placeholder="Password"
              className="login-modal-input"
            />

            <input
              type="password" 
              placeholder="Confirm Password"
              className="login-modal-input"
            />

            <button className="login-modal-btn">Register</button>

            {/* <h2 className="text-xl">Already have an account?</h2>
            <button className="login-modal-btn" onClick={() => setIsRegister(false)}>
            Login
            </button> */}
          </>
        )}
      </div>
    </div>
  );
}
