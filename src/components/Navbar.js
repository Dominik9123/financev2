import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoSettingsOutline } from "react-icons/io5";
import { MdOutlineCompareArrows, MdSpaceDashboard } from "react-icons/md";
import { FiLogIn, FiLogOut } from "react-icons/fi";
import LoginModal from "./LoginModal";
import ResetPasswordModal from "./ResetPasswordModal"; 
import { toast } from "react-toastify";
import "./Navbar.css";
import { requestApi } from "../services/financeApi";
import { useSessionGuard } from "../hooks/useSession";

const Navbar = ({ user, setUser, initialResetData, onCloseReset, sessionExpired = false, guestOnly = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const navigate = useNavigate();
  const logoutPending = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { reportSessionError } = useSessionGuard(user);

  // AUTOMATYCZNE OTWIERANIE: Jeśli w App.js wykryto dane resetu, otwórz modal
  useEffect(() => {
    if (initialResetData) {
      setShowLoginModal(true);
    }
  }, [initialResetData]);

  const handleLogout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setIsLoggingOut(true);
    try {
      await requestApi("/auth/logout", { method: "POST" });
        setUser(null);
        toast.info("Logged out successfully. See you soon!");
        navigate("/");
    } catch (error) {
      reportSessionError(error);
      toast.error(error.status === 0
        ? "Could not confirm logout. Check your connection and try again."
        : "Could not log out. Please try again.");
    } finally {
      logoutPending.current = false;
      setIsLoggingOut(false);
    }
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    if (initialResetData) {
      if (onCloseReset) onCloseReset();
      navigate("/", { replace: true });
    }
  };

  return (
    <nav className="navbar">
      <div className="logo">Finance Tracker</div>
      
      {user && (
        <div className="welcome-container">
          <span className="welcome-separator"> Welcome </span>
          <span className="welcome-text">{user.firstName || user.email}</span>
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

        {guestOnly ? <li>Guest demo</li> : !user || sessionExpired ? (
          <li><button type="button" className="auth-button" onClick={() => { setShowLoginModal(true); setIsOpen(false); }} disabled={isLoggingOut}>
            <span className="icon-wrapper"><FiLogIn size={24} /></span>
            <span>Login</span>
          </button></li>
        ) : (
          <li><button type="button" className="auth-button" onClick={() => { handleLogout(); setIsOpen(false); }} disabled={isLoggingOut}>
            <span className="icon-wrapper"><FiLogOut size={24} /></span>
            <span>Logout</span>
          </button></li>
        )}
      </ul>

      {showLoginModal && (
        <LoginModal 
          onClose={handleCloseLoginModal} 
          setUser={setUser}
          initialResetData={initialResetData}
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
