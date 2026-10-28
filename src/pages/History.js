import React, { useState, useEffect, useMemo } from "react";
import { useCurrencyRates } from "../hooks/useCurrencyRates";
import { convertTransactions } from "../utils/convertCurrency";
import { useTransactions } from "../hooks/useFinanceData";
import "./History.css";

const History = ({ user }) => {
  const transactionData = useTransactions(user);
  const transactions = useMemo(() => [...transactionData.data]
    .sort((a, b) => new Date(b.date) - new Date(a.date)), [transactionData.data]);
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const { rates: localRates, loading: ratesLoading, error: ratesError, reload: fetchNBPRates } = useCurrencyRates();

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);
  }, [user]);

  const conversion = useMemo(() => {
    if (ratesLoading || ratesError) {
      return null;
    }

    try {
      const targetCode = currency.split(" ")[0];

      return { transactions: convertTransactions(transactions, targetCode, localRates) };
    } catch {
      return {
        error: "Nie można przeliczyć transakcji. Sprawdź ich kwoty i waluty."
      };
    }
  }, [transactions, currency, localRates, ratesLoading, ratesError]);

  if (transactionData.loading) {
    return <div className="history-container"><p role="status">Loading transactions…</p></div>;
  }

  if (transactionData.error) {
    return (
      <div className="history-container">
        <p role="alert">{transactionData.error}</p>
        <button type="button" onClick={transactionData.reload}>Retry transactions</button>
      </div>
    );
  }

  if (ratesLoading) {
    return (
      <div className="history-container">
        <p role="status">Pobieranie kursów walut…</p>
      </div>
    );
  }

  if (ratesError) {
    return (
      <div className="history-container">
        <p role="alert">{ratesError}</p>
        <button type="button" onClick={fetchNBPRates}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (conversion.error) {
    return (
      <div className="history-container">
        <p role="alert">{conversion.error}</p>
      </div>
    );
  }
  const filteredTransactions = conversion.transactions.filter(t => {
    const convertedAmount = t.amount;
    const tDate = t.date ? t.date.split("T")[0] : "";
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory || (selectedCategory === "Income" && t.type === "Income");
    const matchesDate = (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
    const matchesAmount = (!minAmount || convertedAmount >= Number(minAmount)) && (!maxAmount || convertedAmount <= Number(maxAmount));
    return matchesCategory && matchesDate && matchesAmount;
  });

  const currencySymbol = currency.split(' ')[1] || currency.split(' ')[0];

  return (
    <div className="history-container">
      <h1 className="outlined-text">Transaction History</h1>
      <div className="filters">
        <label>Category:</label>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="All">All</option>
          <option value="Income">Incomes Only</option>
          {[...new Set(transactions.filter(t => t.type === "Expense").map(t => t.category))].map((cat, i) => (
            <option key={i} value={cat}>{cat}</option>
          ))}
        </select>
        <label>Date Range:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <label>Amount Range:</label>
        <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min" />
        <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max" />
      </div>

      {filteredTransactions.length === 0 && <p>No transactions match your filters.</p>}
      <ul className="transaction-history-list">
        {filteredTransactions.map((t, i) => (
          <li key={t.id || i} className={`transaction-item ${t.type.toLowerCase()}`}>
            <span className="transaction-amount">
              {t.type === "Income" ? "+" : "-"} {currencySymbol} {t.amount.toFixed(2)}
            </span>
            <span className="transaction-category">
              {t.category || "Income"}
            </span>
            <span className="transaction-date">
              {new Date(t.date).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default History;
