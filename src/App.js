import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("http://localhost:5109/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.firstName); 
        } else {
          localStorage.removeItem("user");
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

  if (loading) return <div>Loading...</div>; 

  return (
    <Router basename="/financev2">
      <Navbar user={user} setUser={setUser} />
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/history" element={<History user={user} />} />
          <Route path="/settings" element={<Settings user={user} />} />
        </Routes>
      </main>
    </Router>
  );
};

export default App;