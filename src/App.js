import React, { useState, useEffect, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { SessionContext, useSession } from "./hooks/useSession";
import "./App.css";

const App = () => {
  const guestOnly = process.env.REACT_APP_GUEST_DEMO === "true";
  const { user, status, setUser, checkSession, continueAsGuest, expireSession } = useSession(guestOnly);
  const [initialResetData, setInitialResetData] = useState(null);
  const sessionContext = useMemo(() => ({ expired: status === "expired", expireSession }), [status, expireSession]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");

    if (token && email && !guestOnly) {
      setInitialResetData({ token, email });
    }
  }, [guestOnly]);

  const handleFinalClose = () => {
    if (!initialResetData) return;
    setInitialResetData(null);
    window.history.replaceState({}, document.title, "/financev2/");
  };

  if (status === "checking") return <div className="session-panel" role="status">Checking session…</div>;
  const ownerKey = user?.id ?? "guest";

  return (
    <SessionContext.Provider value={sessionContext}>
      <Router basename="/financev2">
        <Navbar
          user={user}
          setUser={setUser}
          initialResetData={initialResetData}
          onCloseReset={handleFinalClose}
          sessionExpired={status === "expired"}
          guestOnly={guestOnly}
        />
        <main className="container">
          {status === "unavailable" ? (
            <div className="session-panel" role="alert">
              <h1>Could not verify your session</h1>
              <p>The server is unavailable or returned an invalid response. Please try again or choose guest mode.</p>
              <button type="button" onClick={checkSession}>Retry session check</button>
              <button type="button" onClick={continueAsGuest}>Continue as guest</button>
            </div>
          ) : <>
            {status === "expired" && (
              <div className="session-panel session-banner" role="alert">
                <p>Your session has expired. Use Login to sign in again. Account data will not be saved until you sign in.</p>
                <button type="button" onClick={continueAsGuest}>Continue as guest</button>
              </div>
            )}
            <Routes>
              <Route
                path="/"
                element={<Dashboard user={user} key={`${ownerKey}:${initialResetData ? "reset" : "normal"}`} />}
              />
              <Route path="/history" element={<History user={user} key={ownerKey} />} />
              <Route path="/settings" element={<Settings user={user} key={ownerKey} />} />
            </Routes>
          </>}
        </main>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="dark"
        />
      </Router>
    </SessionContext.Provider>
  );
};

export default App;
