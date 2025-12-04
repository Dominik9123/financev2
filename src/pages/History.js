import React, { useState, useEffect } from "react";
import { FaFolderOpen } from "react-icons/fa"; 
import "./History.css";

const History = () => {
  const [transactions, setTransactions] = useState([]);
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);

    const savedExpenses = localStorage.getItem("expenses");
    const savedIncomes = localStorage.getItem("salaries");

    try {
      const parsedExpenses = savedExpenses ? JSON.parse(savedExpenses).map(exp => ({
        ...exp,
        type: "Expense"
      })) : [];

      const parsedIncomes = savedIncomes ? JSON.parse(savedIncomes).map(inc => ({
        ...inc,
        type: "Income"
      })) : [];

      const allTransactions = [...parsedExpenses, ...parsedIncomes].sort((a, b) => new Date(b.date) - new Date(a.date));

      setTransactions(allTransactions);
    } catch (error) {
      console.log("Błąd odczytu historii", error);
      setTransactions([]);
    }
  }, []);

  const getCategoryIcon = (category) => {
    if (!category) return "💵 Income";

    const defaultIcons = {
      "Housing": "🏠",
      "Food": "🍔",
      "Transport": "🚗",
      "Entertainment": "🎉",
      "Shopping": "🛒",
      "HealthCare": "💊",
      "Travel": "✈️",
      "Savings": "📈",
      "Education": "📚",
      "Debt's": "💳",
      "Income": "💵 Income",
    };

    const customCategories = JSON.parse(localStorage.getItem("customCategories") || "[]");
    const customCategory = customCategories.find(cat => cat.name === category);
  
    return customCategory ? <FaFolderOpen style={{ color: "#fff" }}/> : defaultIcons[category?.trim()] || <FaFolderOpen />;
  };

  const filteredTransactions = transactions.filter(transaction => {
    return (
        (selectedCategory === "All" || transaction.category === selectedCategory || 
    (selectedCategory === "Income" && transaction.type === "Income")) &&
    (!startDate || transaction.date >= startDate) &&
    (!endDate || transaction.date <= endDate) &&
    (!minAmount || transaction.amount >= Number(minAmount)) &&
    (!maxAmount || transaction.amount <= Number(maxAmount))
    );
  });

  return (  
    <div className="history-container">
      <h1 className="outlined-text">Transaction History</h1>

      {/* Filtry */}
      <div className="filters">
        <label>Category:</label>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="All">All</option>
            <option value="Income">Income</option>
          {transactions.map((transaction, index) => (
           transaction.category && <option key={index} value={transaction.category}>{transaction.category}</option>
          ))}
        </select>

        <label>Date Range:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <label>Amount Range:</label>
        <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min Amount" />
        <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max Amount" />
      </div>

      <ul className="transaction-history-list">
        {filteredTransactions.map((transaction, index) => (
          <li key={index} className={`transaction-item ${transaction.type.toLowerCase()}`}>
            <span className="transaction-amount">
              {transaction.type === "Income" ? "+" : "-"} {currency} {transaction.amount.toFixed(2)}
            </span>
            <span className="transaction-category">
              {getCategoryIcon(transaction.category)} {transaction.category}
            </span>
            <span className="transaction-date">{transaction.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default History;
