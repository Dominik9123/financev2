import React, { useState } from "react";
import { FaEye, FaEyeSlash, FaExclamationTriangle } from "react-icons/fa";
import "./LoginModal.scss";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function LoginModal({ onClose, onReset, setUser, initialResetData }) {
  const navigate = useNavigate();
  // Jeśli mamy dane resetu, startujemy od widoku "setNewPassword"
  const [view, setView] = useState(initialResetData ? "setNewPassword" : "login");
  
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Stan dla logowania i resetu hasła
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Stan dla rejestracji
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleKeyUp = (e) => {
    setIsCapsLockOn(e.getModifierState("CapsLock"));
  };

  // Logika sprawdzania wymagań dla widoku rejestracji i resetu
  const getPasswordRequirements = (pwd) => ({
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5109/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: "include"
      });

      if (!response.ok) {
        toast.error("Login failed! Check your credentials.");
        return;
      }

      const data = await response.json();
      toast.success(`Welcome back ${data.firstName}!`);
      if (setUser) setUser(data.firstName);
      onClose();
    } catch (error) {
      toast.error("Connection error.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (regPassword !== confirmPassword) {
      toast.warning("Passwords do not match!");
      return;
    }

    try {
      const response = await fetch("http://localhost:5109/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email: regEmail, password: regPassword })
      });

      if (!response.ok) {
        toast.error("Registration failed!");
        return;
      }

      toast.info("Account created! You can now log in.");
      setView("login");
    } catch (error) {
      toast.error("Server is not responding.");
    }
  };

  const handleFinalReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.warning("Passwords do not match!");
      return;
    }

    try {
      const response = await fetch("http://localhost:5109/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: initialResetData.email,
          token: initialResetData.token,
          newPassword: password
        }),
      });

      if (response.ok) {
        toast.success("Password changed successfully! Redirecting...");
      
        // Czyścimy URL natychmiast
        window.history.replaceState({}, document.title, "/financev2/");
        setView("login");
        setPassword("");
        setConfirmPassword("");

        // Twardy refresh po chwili, aby Dashboard załadował się na czysto
        setTimeout(() => {
          window.location.href = "/financev2/";
        }, 1500);
      } else {
        const errorData = await response.json();
        toast.error(errorData[0]?.description || "Reset failed. Link might be expired.");
      }
    } catch (error) {
      toast.error("Server connection error.");
    }
  };

  const regReqs = getPasswordRequirements(regPassword);
  const resetReqs = getPasswordRequirements(password);

  return (
    <div className="login-modal-backdrop" onClick={onClose}>
      <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>×</button>

        {/* --- WIDOK: LOGOWANIE --- */}
        {view === "login" && (
          <form onSubmit={handleLogin}>
            <h2 className="text-xl font-semibold mb-4">Welcome Again!</h2>
            <input type="email" placeholder="E-mail" className="login-modal-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div className="password-container">
              <input type={showPassword ? "text" : "password"} placeholder="Password" className="login-modal-input" value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={handleKeyUp} required />
              <span className="password-icon" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FaEyeSlash /> : <FaEye />}</span>
            </div>
            {isCapsLockOn && <div className="caps-lock-warning"><FaExclamationTriangle /> Caps Lock is ON</div>}
            <div className="login-modal-remember-me">
              <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <label htmlFor="rememberMe">Remember Me</label>
            </div>
            <button className="login-modal-btn">Login</button>
            <h2 className="text-xl mt-4">Forgot your Password?</h2>
            <button type="button" className="login-modal-btn" onClick={onReset}>Reset Password</button>
            <h2 className="text-xl">New here?</h2>
            <button type="button" className="login-modal-btn" onClick={() => setView("register")}>Register</button>
          </form>
        )}

        {/* --- WIDOK: REJESTRACJA --- */}
        {view === "register" && (
          <form onSubmit={handleRegister}>
            <h2 className="text-xl font-semibold mb-4">Create an Account</h2>
            <input type="text" placeholder="First Name" className="login-modal-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <input type="text" placeholder="Last Name" className="login-modal-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            <input type="email" placeholder="E-mail" className="login-modal-input" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
            <div className="password-container">
              <input type={showPassword ? "text" : "password"} placeholder="Password" className="login-modal-input" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} onKeyUp={handleKeyUp} required />
              <span className="password-icon" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FaEyeSlash /> : <FaEye />}</span>
              <div className="password-tooltip">
                <p>Requirements:</p>
                <ul>
                  <li className={regReqs.length ? "valid" : ""}>Min. 8 chars</li>
                  <li className={regReqs.uppercase ? "valid" : ""}>Uppercase</li>
                  <li className={regReqs.number ? "valid" : ""}>Number</li>
                  <li className={regReqs.special ? "valid" : ""}>Special (!@#)</li>
                </ul>
              </div>
            </div>
            <input type="password" placeholder="Confirm Password" className="login-modal-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <button className="login-modal-btn">Register</button>
            <button type="button" className="login-modal-btn mt-2" onClick={() => setView("login")}>Back to Login</button>
          </form>
        )}

        {/* --- WIDOK: USTAWIANIE NOWEGO HASŁA --- */}
        {view === "setNewPassword" && (
          <form onSubmit={handleFinalReset}>
            <h2 className="text-xl font-semibold mb-2">Set New Password</h2>
            <p className="mb-4 text-sm text-gray-400">Updating password for: {initialResetData?.email}</p>
            
            <div className="password-container">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="New Password" 
                className="login-modal-input" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                onKeyUp={handleKeyUp}
                required 
              />
              <span className="password-icon" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              
              <div className="password-tooltip">
                <p>New Password Requirements:</p>
                <ul>
                  <li className={resetReqs.length ? "valid" : ""}>Min. 8 chars</li>
                  <li className={resetReqs.uppercase ? "valid" : ""}>Uppercase</li>
                  <li className={resetReqs.number ? "valid" : ""}>Number</li>
                  <li className={resetReqs.special ? "valid" : ""}>Special (!@#)</li>
                </ul>
              </div>
            </div>

            {isCapsLockOn && <div className="caps-lock-warning"><FaExclamationTriangle /> Caps Lock is ON</div>}

            <input 
              type="password" 
              placeholder="Confirm New Password" 
              className="login-modal-input" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
            />
            <button className="login-modal-btn">Update Password</button>
            <button type="button" className="login-modal-btn mt-2" onClick={() => setView("login")}>Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}