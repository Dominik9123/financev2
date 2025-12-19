import React, { useState } from "react";
import { Link } from "react-router-dom";  
import { IoSettingsOutline } from "react-icons/io5";
import { MdOutlineCompareArrows, MdSpaceDashboard } from "react-icons/md";
import { FiLogIn, FiLogOut } from "react-icons/fi";
import LoginModal from "./LoginModal";
import ResetPasswordModal from "./ResetPasswordModal"; 
import "./Navbar.css";

const Navbar = ({ user, setUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleLogout = async () => {
    try {
      // 1. Serwer usuwa ciasteczko sesji
      await fetch("http://localhost:5109/api/auth/logout", { 
        method: "POST", 
        credentials: "include"
      });


      localStorage.clear();

      // 3. Reset stanu w React
      setUser(null);


      window.location.href = "/financev2/";
    } catch (error) {
      console.error("Błąd podczas wylogowywania:", error);
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <nav className="navbar">
      <div className="logo">Finance Tracker</div>
      
      {user && (
        <div className="welcome-container">
          <span className="welcome-separator"> Welcome </span>
          <span className="welcome-text">{user}</span>
        </div>
      )}
      
      <div className="burger-menu" onClick={() => setIsOpen(!isOpen)}>
        <div className={isOpen ? "bar open" : "bar"}></div>
        <div className={isOpen ? "bar open" : "bar"}></div>
        <div className={isOpen ? "bar open" : "bar"}></div>
      </div>

      <ul className={`nav-links ${isOpen ? "open" : ""}`}>
        <li>
          <Link to="/" onClick={() => setIsOpen(false)}>
            <span className="icon-wrapper"><MdSpaceDashboard size={24} /></span>
            <span>Dashboard</span>
          </Link>
        </li>
        <li>
          <Link to="/history" onClick={() => setIsOpen(false)}>
            <span className="icon-wrapper"><MdOutlineCompareArrows size={24} /></span>
            <span>Expense History</span>
          </Link>
        </li>
        <li>
          <Link to="/settings" onClick={() => setIsOpen(false)}>
            <span className="icon-wrapper"><IoSettingsOutline size={24} /></span>
            <span>Settings</span>
          </Link>
        </li>

        {!user ? (
          <li onClick={() => { setShowLoginModal(true); setIsOpen(false); }}>
            <span className="icon-wrapper"><FiLogIn size={24} /></span>
            <span>Login</span>
          </li>
        ) : (
          <li onClick={handleLogout}>
            <span className="icon-wrapper"><FiLogOut size={24} /></span>
            <span>Logout</span>
          </li>
        )}
      </ul>

      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)} 
          setUser={setUser}
          onReset={() => { setShowLoginModal(false); setShowReset(true); }}
        />
      )}

      {showReset && (
        <ResetPasswordModal
          onClose={() => setShowReset(false)}
          onBackToLogin={() => { setShowReset(false); setShowLoginModal(true); }} 
        />
      )}
    </nav>
  );
};

export default Navbar;