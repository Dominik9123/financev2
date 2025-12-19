import React from "react";
import "./LoginModal.scss";

export default function LoginModal({ onClose, onReset, setUser }) {
  const [isRegister, setIsRegister] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);

  // Stan logowania
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Stan rejestracji
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    console.log({ email, password });

    try {
      const response = await fetch("http://localhost:5109/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: "include"
      });

      if (!response.ok) {
        alert("Login failed! Check your credentials.");
        return;
      }

      const data = await response.json();
      console.log(data);

      alert(`Logged in as ${data.firstName}`);
      if (setUser) setUser(data.firstName);
      localStorage.setItem("userFirstName", data.firstName); 
      onClose();
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    }
  };

  // Rejestracja
  const handleRegister = async (e) => {
    e.preventDefault();
    if (regPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const response = await fetch("http://localhost:5109/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName, 
          lastName: lastName,   
          email: regEmail,
          password: regPassword
        })
      });

      if (!response.ok) {
        alert("Registration failed! Check your data.");
        return;
      }

      const data = await response.json();
      console.log(data);
      alert("User registered!");
      setIsRegister(false); // wracamy do logowania
    } catch (error) {
      console.error(error);
      alert("Registration failed!");
    }
  };

  return (
    <div className="login-modal-backdrop" onClick={onClose}>
      <div className="login-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>×</button>

        {!isRegister ? (
          <form onSubmit={handleLogin}>
            <h2 className="text-xl font-semibold mb-4">Welcome Again!</h2>

            <input
              type="email"
              placeholder="E-mail"
              className="login-modal-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="login-modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="login-modal-remember-me">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember Me</label>
            </div>

            <button className="login-modal-btn">Login</button>

            <h2 className="text-xl mt-4">Forgot your Password?</h2>
            <button type="button" className="login-modal-btn" onClick={onReset}>
              Reset Password
            </button>

            <h2 className="text-xl">New here?</h2>
            <button type="button" className="login-modal-btn" onClick={() => setIsRegister(true)}>
              Register
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <h2 className="text-xl font-semibold mb-4">Create an Account</h2>

            <input
              type="text"
              placeholder="First Name"
              className="login-modal-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Last Name"
              className="login-modal-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <input
              type="email"
              placeholder="E-mail"
              className="login-modal-input"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="login-modal-input"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="Confirm Password"
              className="login-modal-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button className="login-modal-btn">Register</button>

            <h2 className="text-xl mt-4">Already have an account?</h2>
            <button type="button" className="login-modal-btn" onClick={() => setIsRegister(false)}>
              Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
