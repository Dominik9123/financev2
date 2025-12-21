import React, { useState, useEffect, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Settings.scss";

const currencyOptions = ["USD ($)", "EUR (€)", "PLN (zł)", "GBP (£)", "JPY (¥)"];

const Settings = ({ user }) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCurrency, setSelectedCurrency] = useState("USD ($)");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const [annualBudget, setAnnualBudget] = useState(0);
  const [savedBudget, setSavedBudget] = useState(0);
  const [budgetMessage, setBudgetMessage] = useState("");

  const [customCategories, setCustomCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");

  const toastConfig = {
    position: "top-right",
    autoClose: 3000,
    theme: "dark",
  };

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
    toast.success(`Currency changed to ${selectedCurrency}! 💰`, toastConfig);
  };

  const handleBudgetChange = (event) => {
    setAnnualBudget(Number(event.target.value));
  };

    const handleConfirmBudget = () => {
    localStorage.setItem("annualBudget", annualBudget);
    setSavedBudget(annualBudget);
    toast.info(`Annual budget updated to ${currency} ${annualBudget} ✅`, toastConfig);
  };

  // --- DODAWANIE KATEGORII (HYBRYDOWE) ---
 const handleAddCategory = async () => {
    if (newCategory.trim() === "") {
        toast.warning("Category name cannot be empty! ⚠️", toastConfig);
        return;
    }

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
          toast.success("New category added to cloud! ☁️", toastConfig);
          return;
        }
      } catch (error) {
        toast.error("Failed to save category to server.", toastConfig);
      }
    }

    // Tryb Gość
    const updatedCategories = [...customCategories, { name: newCategory }];
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setCustomCategories(updatedCategories);
    setNewCategory("");
    toast.success("Category saved locally! 💾", toastConfig);
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
          toast.error("Category deleted from server!", toastConfig);
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
    toast.error("Category removed! ❌", toastConfig);
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
        toast.error("Server reset error. Connection failed.", toastConfig);
        return;
      }
    }

    localStorage.removeItem("salaries");
    localStorage.removeItem("expenses");
    
        toast.success("All data has been wiped! 🔄", {
        ...toastConfig,
        onClose: () => window.location.reload() // Przeładuj po zamknięciu toasta
    });
  };

const executeReset = async () => {
  if (user) {
    try {
      await fetch("http://localhost:5109/api/transaction/reset", {
        method: "DELETE",
        credentials: "include"
      });
    } catch (error) {
      toast.error("Server reset error.", toastConfig);
      return;
    }
  }
  localStorage.removeItem("salaries");
  localStorage.removeItem("expenses");
  
  toast.success("Data wiped! Reloading...", {
    ...toastConfig,
    onClose: () => window.location.reload()
  });
};

  return (
    <div className="settings-container">
      <ToastContainer />
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
        <button className="reset-button" onClick={() => setIsResetModalOpen(true)}>
          {user ? "Reset Account Data 🔄" : "Reset Local Data 🔄"}
        </button>
      </div>
      {isResetModalOpen && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Confirm Reset ⚠️</h3>
      <p>Are you sure? This will delete all your transactions. This action cannot be undone!</p>
      <div className="modal-footer">
        <button className="btn-cancel" onClick={() => setIsResetModalOpen(false)}>
          Cancel
        </button>
        <button className="btn-confirm-danger" onClick={() => {
          executeReset();
          setIsResetModalOpen(false);
        }}>
          Yes, Delete Everything
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default Settings;