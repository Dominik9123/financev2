import React, { useState, useEffect } from "react";
import "./Settings.css";
import Dashboard from "./Dashboard";


const currencyOptions = ["USD ($)", "EUR (€)", "PLN (zł)", "GBP (£)", "JPY (¥)"];

const Settings = () => {
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCurrency, setSelectedCurrency] = useState("USD ($)");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  // Roczny budżet
  const [annualBudget, setAnnualBudget] = useState(0);
  const [savedBudget, setSavedBudget] = useState(0);
  const [budgetMessage, setBudgetMessage] = useState("");

  // Kategorie użytkownika
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    const storedBudget = localStorage.getItem("annualBudget") || "0";
    const savedCategories = JSON.parse(localStorage.getItem("customCategories") || "[]");

    setCurrency(savedCurrency);
    setSelectedCurrency(savedCurrency);
    setSavedBudget(Number(storedBudget));
    setAnnualBudget(Number(storedBudget));
    setCustomCategories(savedCategories);
    setBudgetMessage(`Annual budget set to: ${savedCurrency} ${storedBudget} ✅`);

  }, []);

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

  const handleResetData = () => {
    localStorage.clear();
    window.location.reload();
  };

  // Obsługa dodawania, edycji i usuwania kategorii użytkownika
  const handleAddCategory = () => {
    if (newCategory.trim() === "") return;
    const updatedCategories = [...customCategories, { name: newCategory }];
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setCustomCategories(updatedCategories);
    setNewCategory("");
  };

  const handleEditCategory = (index, newName) => {
    const updatedCategories = [...customCategories];
    updatedCategories[index].name = newName;
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setCustomCategories(updatedCategories);
  };

  const handleDeleteCategory = (index) => {
    const updatedCategories = customCategories.filter((_, i) => i !== index);
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setCustomCategories(updatedCategories);
  };


  return (
  <div className="settings-container">
    <h2>Settings</h2>
    <p>Customize your experience and preferences</p>

    {/* Wybór waluty */}
    <label className="settings-label">Choose Currency:</label>
    <select className="currency-select" value={selectedCurrency} onChange={handleCurrencyChange}>
      {currencyOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>

    {confirmationMessage && <p className="confirmation-message">{confirmationMessage}</p>}

    <button className="confirm-button" onClick={handleConfirmCurrency}>Confirm Currency ✅</button>

    {/* Roczny budżet */}
    <div className="budget-section">
      <label className="settings-label">Set Annual Budget:</label>
      <input
        type="number"
        className="budget-input"
        value={annualBudget}
        onChange={handleBudgetChange}
        min="0"
      />
      <button className="budget-button" onClick={handleConfirmBudget}>
        Confirm Budget ✅
      </button>

      {budgetMessage && <p className="budget-message">{budgetMessage}</p>}
    </div>
        {/* Personalizacja kategorii użytkownika */}
        <div className="custom-category-section">
            <label className="settings-label">Add Custom Category:</label>
            <input
            type="text"
            className="category-input"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value.slice(0, 25))}
            maxLength="25"
            />

             <button className="category-button" onClick={handleAddCategory}>
               Add Category ➕
            </button>
            {customCategories.length > 0 && <p>Clicking ❌ removes the category</p>}

            <ul className="category-list">
              {customCategories.map((category, index) => (
                <li key={index} className="category-item">
                    <span className="category-name">{category.name}</span>
                <button onClick={() => handleDeleteCategory(index)} className="delete-button">❌</button>
                </li>
             ))}
            </ul>

        </div>
    

    <div className="reset-section">
      <button className="reset-button" onClick={handleResetData}>Reset Data 🔄</button>
    </div>
  </div>
);
};

export default Settings;
