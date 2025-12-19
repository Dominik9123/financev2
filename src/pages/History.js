import React, { useState, useEffect, useCallback } from "react";
import { FaFolderOpen } from "react-icons/fa"; 
import "./History.css";

const History = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // --- LOGIKA POBIERANIA DANYCH (HYBRYDOWA) ---
  const fetchHistory = useCallback(async () => {
    if (user) {
      // Tryb Zalogowany: Pobierz z API
      try {
        const response = await fetch("http://localhost:5109/api/transaction", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
          setTransactions(sortedData);
          return;
        }
      } catch (error) {
        console.error("Błąd API w historii:", error);
      }
    }

    // Tryb Gość: Pobierz z localStorage
    const localSalaries = JSON.parse(localStorage.getItem("salaries") || "[]").map(t => ({ ...t, type: "Income", category: "Income" }));
    const localExpenses = JSON.parse(localStorage.getItem("expenses") || "[]").map(t => ({ ...t, type: "Expense" }));
    
    const combined = [...localSalaries, ...localExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(combined);
  }, [user]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);
    fetchHistory();
  }, [user, fetchHistory]);

  const getCategoryIcon = (category, type) => {
    if (type === "Income") return "💵 Income";
    const defaultIcons = {
      "Housing": "🏠", "Food": "🍔", "Transport": "🚗", "Entertainment": "🎉",
      "Shopping": "🛒", "HealthCare": "💊", "Travel": "✈️", "Savings": "📈",
      "Education": "📚", "Debt's": "💳",
    };
    return defaultIcons[category?.trim()] || <FaFolderOpen />;
  };

  // --- FILTROWANIE ---
  const filteredTransactions = transactions.filter(transaction => {
    const tDate = transaction.date ? transaction.date.split("T")[0] : "";
    const matchesCategory = selectedCategory === "All" || 
                            transaction.category === selectedCategory || 
                            (selectedCategory === "Income" && transaction.type === "Income");
    const matchesDate = (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
    const matchesAmount = (!minAmount || transaction.amount >= Number(minAmount)) && 
                          (!maxAmount || transaction.amount <= Number(maxAmount));

    return matchesCategory && matchesDate && matchesAmount;
  });

  const availableCategories = [...new Set(transactions
    .filter(t => t.type === "Expense")
    .map(t => t.category))
  ];

  return (  
    <div className="history-container">
      <h1 className="outlined-text">Transaction History {user ? `(${user})` : "(Guest)"}</h1>

      <div className="filters">
        <label>Category:</label>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="All">All</option>
          <option value="Income">Incomes Only</option>
          {availableCategories.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>

        <label>Date Range:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <label>Amount Range:</label>
        <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min" />
        <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max" />
      </div>

      <ul className="transaction-history-list">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction, index) => (
            <li key={transaction.id || index} className={`transaction-item ${transaction.type.toLowerCase()}`}>
              <span className="transaction-amount">
                {transaction.type === "Income" ? "+" : "-"} {currency} {transaction.amount.toFixed(2)}
              </span>
              <span className="transaction-category">
                {getCategoryIcon(transaction.category, transaction.type)} {transaction.category || "Income"}
              </span>
              <span className="transaction-date">
                {new Date(transaction.date).toLocaleDateString()}
              </span>
            </li>
          ))
        ) : (
          <p style={{ color: "white", textAlign: "center" }}>No transactions found.</p>
        )}
      </ul>
    </div>
  );
};

export default History;