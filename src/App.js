import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialResetData, setInitialResetData] = useState(null);

  useEffect(() => {
    // 1. Wykrywanie parametrów resetu w adresie URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");

    if (token && email) {
      setInitialResetData({ token, email });
    }

    // 2. Sprawdzanie sesji użytkownika
    const checkAuth = async () => {
      try {
        const response = await fetch("http://localhost:5109/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.firstName);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Błąd autoryzacji:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Ta funkcja czyści stan i pasek adresu URL
  const handleFinalClose = () => {
    setInitialResetData(null);
    // Usuwamy ?token=... z paska adresu, aby Dashboard mógł się odświeżyć
    window.history.replaceState({}, document.title, "/financev2/");
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Router basename="/financev2">
      <Navbar 
        user={user} 
        setUser={setUser} 
        initialResetData={initialResetData} 
        onCloseReset={handleFinalClose}
      />
      <main className="container">
        <Routes>
          {/* Klucz key={window.location.search} jest krytyczny - wymusza przeładowanie 
              Dashboardu, gdy parametry URL znikają po resecie hasła */}
          <Route 
            path="/" 
            element={<Dashboard user={user} key={window.location.search} />} 
          />
          <Route path="/history" element={<History user={user} />} />
          <Route path="/settings" element={<Settings user={user} />} />
        </Routes>
      </main>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />
    </Router>
  );
};

export default App;