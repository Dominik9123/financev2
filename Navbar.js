import React, { useState } from "react";
import { Link } from "react-router-dom";  
import { IoSettingsOutline } from "react-icons/io5";
import { MdOutlineCompareArrows, MdSpaceDashboard } from "react-icons/md";
import { FiLogIn } from "react-icons/fi";
import LoginModal from "./LoginModal";
import ResetPasswordModal from "./ResetPasswordModal"; 
import "./Navbar.css";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showReset, setShowReset] = useState(false);

  return (
    <nav className="navbar">
      <div className="logo">Finance Tracker</div>
      
      <div className="burger-menu" onClick={() => setIsOpen(!isOpen)}>
        <div className={isOpen ? "bar open" : "bar"}></div>
        <div className={isOpen ? "bar open" : "bar"}></div>
        <div className={isOpen ? "bar open" : "bar"}></div>
      </div>

      <ul className={`nav-links ${isOpen ? "open" : ""}`}>
        <li>
          <Link to="/" onClick={() => setIsOpen(false)}>
            <span className="icon-wrapper">
              <MdSpaceDashboard size={24} />
            </span>
            <span>Dashboard</span>
          </Link>
        </li>
        <li>
          <Link to="/history" onClick={() => setIsOpen(false)}>
            <span className="icon-wrapper">
              <MdOutlineCompareArrows size={24} />
            </span>
            <span>Expense History</span>
          </Link>
        </li>
        <li>
          <Link to="/settings" onClick={() => setIsOpen(false)}>
            <span className="icon-wrapper">
              <IoSettingsOutline size={24} />
            </span>
            <span>Settings</span>
          </Link>
        </li>
        <li onClick={() => { setShowLoginModal(true); setIsOpen(false); }}>
          <span className="icon-wrapper">
            <FiLogIn size={24} />
          </span>
          <span>Login</span>
        </li>
      </ul>

      {/* Modale */}
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)} 
          onReset={() => { 
            setShowLoginModal(false); 
            setShowReset(true); 
          }} 
        />
      )}

      {showReset && (
        <ResetPasswordModal
          onClose={() => setShowReset(false)}
          onBackToLogin={() => {
            setShowReset(false);
            setShowLoginModal(true);
          }} 
        />
      )}
    </nav>
  );
};

export default Navbar;
