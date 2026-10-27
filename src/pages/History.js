import React, { useState, useEffect, useCallback, useMemo } from "react";
import { fetchCurrencyRates } from "../services/currencyService";
import { convertCurrency } from "../utils/convertCurrency";
import "./History.css";

const History = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [currency, setCurrency] = useState("USD ($)");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Stan dla kursów walut (dla localStorage)
const [localRates, setLocalRates] = useState({ PLN: 1 });
const [ratesLoading, setRatesLoading] = useState(true);
const [ratesError, setRatesError] = useState("");

  const fetchNBPRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError("");

    try {
      const newRates = await fetchCurrencyRates();
      setLocalRates(newRates);
    } catch (error) {
      console.error("Błąd pobierania kursów NBP:", error);
      setRatesError("Nie udało się pobrać kursów walut.");
    } finally {
      setRatesLoading(false);
    }
  }, []);

useEffect(() => {
  fetchNBPRates();
}, [fetchNBPRates]);

  const fetchHistory = useCallback(async () => {
    if (user) {
      try {
        const response = await fetch("http://localhost:5109/api/transaction", {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
          return;
        }
      } catch (error) {
        console.error("Błąd API transakcji:", error);
      }
    }

    // Tryb Gość: Pobierz z localStorage i dodaj pole currency jeśli go nie ma
    const localSalaries = JSON.parse(localStorage.getItem("salaries") || "[]").map(t => ({ 
      ...t, type: "Income", category: "Income", currency: t.currency || "USD" 
    }));
    const localExpenses = JSON.parse(localStorage.getItem("expenses") || "[]").map(t => ({ 
      ...t, type: "Expense", currency: t.currency || "USD" 
    }));
    
    setTransactions([...localSalaries, ...localExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)));
  }, [user]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);
    fetchHistory();
  }, [user, fetchHistory]);

  // --- UNIWERSALNA LOGIKA KURSÓW ---
const conversion = useMemo(() => {
  if (ratesLoading || ratesError) {
    return null;
  }

  try {
    const targetCode = currency.split(" ")[0];

    if (!Number.isFinite(localRates[targetCode])) {
      throw new Error("Nieobsługiwana waluta docelowa.");
    }

    const convertedTransactions = transactions.map(transaction => {
      if (!Number.isFinite(transaction.amount)) {
        throw new Error("Niepoprawna kwota transakcji.");
      }

      return {
        ...transaction,
        amount: convertCurrency(
          transaction.amount,
          transaction.currency,
          targetCode,
          localRates
        ),
        currency: targetCode
      };
    });

    return { transactions: convertedTransactions };
  } catch {
    return {
      error: "Nie można przeliczyć transakcji. Sprawdź ich kwoty i waluty."
    };
  }
}, [transactions, currency, localRates, ratesLoading, ratesError]);

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
  // --- FILTROWANIE ---
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
      {/* ... (sekcja filtrów bez zmian) ... */}
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
