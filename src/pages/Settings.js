import React, { useState, useEffect, useCallback } from "react";
import "./Settings.css";

const currencyOptions = ["USD ($)", "EUR (€)", "PLN (zł)", "GBP (£)", "JPY (¥)"];

const Settings = ({ user }) => {
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCurrency, setSelectedCurrency] = useState("USD ($)");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const [annualBudget, setAnnualBudget] = useState(0);
  const [savedBudget, setSavedBudget] = useState(0);
  const [budgetMessage, setBudgetMessage] = useState("");

  const [customCategories, setCustomCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");

  // --- LOGIKA POBIERANIA KATEGORII (HYBRYDOWA) ---
  const fetchCategories = useCallback(async () => {
    if (user) {
      try {
        const response = await fetch("http://localhost:5109/api/category", {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCustomCategories(data); // Baza zwraca obiekty {id, name}
          return;
        }
      } catch (error) {
        console.error("Błąd pobierania kategorii z API:", error);
      }
    }
    // Tryb Gość lub błąd API
    const saved = JSON.parse(localStorage.getItem("customCategories") || "[]");
    setCustomCategories(saved);
  }, [user]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    const storedBudget = localStorage.getItem("annualBudget") || "0";

    setCurrency(savedCurrency);
    setSelectedCurrency(savedCurrency);
    setSavedBudget(Number(storedBudget));
    setAnnualBudget(Number(storedBudget));
    setBudgetMessage(`Annual budget set to: ${savedCurrency} ${storedBudget} ✅`);

    fetchCategories();
  }, [user, fetchCategories]);

  const handleCurrencyChange = (event) => {
    setSelectedCurrency(event.target.value);
  };

  const handleConfirmCurrency = () => {
    setCurrency(selectedCurrency);
    localStorage.setItem("currency", selectedCurrency);
    setConfirmationMessage(`Currency changed to ${selectedCurrency}! ✅`);
  };

  const handleBudgetChange = (event) => {
    setAnnualBudget(Number(event.target.value));
  };

  const handleConfirmBudget = () => {
    localStorage.setItem("annualBudget", annualBudget);
    setSavedBudget(annualBudget);
    setBudgetMessage(`Annual budget set to: ${currency} ${annualBudget} ✅`);
  };

  // --- DODAWANIE KATEGORII (HYBRYDOWE) ---
  const handleAddCategory = async () => {
    if (newCategory.trim() === "") return;

    if (user) {
      try {
        const response = await fetch("http://localhost:5109/api/category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategory }), // Wysyłamy DTO
          credentials: "include",
        });
        if (response.ok) {
          setNewCategory("");
          fetchCategories();
          return;
        }
      } catch (error) {
        console.error("Błąd zapisu kategorii na serwerze:", error);
      }
    }

    // Tryb Gość
    const updatedCategories = [...customCategories, { name: newCategory }];
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setCustomCategories(updatedCategories);
    setNewCategory("");
  };

  // --- USUWANIE KATEGORII (HYBRYDOWE) ---
  const handleDeleteCategory = async (categoryObj) => {
    if (user && categoryObj.id) {
      try {
        const response = await fetch(`http://localhost:5109/api/category/${categoryObj.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (response.ok) {
          fetchCategories();
          return;
        }
      } catch (error) {
        console.error("Błąd usuwania kategorii z serwera:", error);
      }
    }

    // Tryb Gość
    const updatedCategories = customCategories.filter((c) => c.name !== categoryObj.name);
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setCustomCategories(updatedCategories);
  };

  // --- RESETOWANIE DANYCH ---
  const handleResetData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL transaction data? This cannot be undone.")) return;

    if (user) {
      try {
        const response = await fetch("http://localhost:5109/api/transaction/reset", {
          method: "DELETE",
          credentials: "include"
        });

        if (!response.ok) throw new Error("Failed to reset data on server");
      } catch (error) {
        console.error("Server reset error:", error);
        alert("Could not reset server data. Check your connection.");
        return;
      }
    }

    localStorage.removeItem("salaries");
    localStorage.removeItem("expenses");
    
    alert("Transaction data has been reset! 🔄");
    window.location.reload(); 
  };

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      <p>Customize your experience and preferences</p>

      <label className="settings-label">Choose Currency:</label>
      <select className="currency-select" value={selectedCurrency} onChange={handleCurrencyChange}>
        {currencyOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>

      {confirmationMessage && <p className="confirmation-message">{confirmationMessage}</p>}
      <button className="confirm-button" onClick={handleConfirmCurrency}>Confirm Currency ✅</button>

      <div className="budget-section">
        <label className="settings-label">Set Annual Budget:</label>
        <input
          type="number"
          className="budget-input"
          value={annualBudget}
          onChange={handleBudgetChange}
          min="0"
        />
        <button className="budget-button" onClick={handleConfirmBudget}>Confirm Budget ✅</button>
        {budgetMessage && <p className="budget-message">{budgetMessage}</p>}
      </div>

      <div className="custom-category-section">
        <label className="settings-label">Add Custom Category:</label>
        <input
          type="text"
          className="category-input"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value.slice(0, 25))}
          maxLength="25"
        />
        <button className="category-button" onClick={handleAddCategory}>Add Category ➕</button>
        {customCategories.length > 0 && <p>Clicking ❌ removes the category</p>}

        <ul className="category-list">
          {customCategories.map((category, index) => (
            <li key={category.id || index} className="category-item">
              <span className="category-name">{category.name}</span>
              <button onClick={() => handleDeleteCategory(category)} className="delete-button">❌</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="reset-section">
        <button className="reset-button" onClick={handleResetData}>
          {user ? "Reset Account Data 🔄" : "Reset Local Data 🔄"}
        </button>
      </div>
    </div>
  );
};

export default Settings;