import React, { useState, useEffect, useCallback, useMemo } from "react";
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

  // Stan dla kursów walut (dla localStorage)
  const [localRates, setLocalRates] = useState({ USD: 1, EUR: 1, PLN: 1 });
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });

  const getCurrencyCode = () => {
    return (localStorage.getItem("currency") || "USD ($)").split(" ")[0];
  };

  // --- POBIERANIE KURSÓW Z NBP DLA LOCALSTORAGE ---
  const fetchNBPRates = useCallback(async () => {
    try {
      const response = await fetch("https://api.nbp.pl/api/exchangerates/tables/A/?format=json");
      const data = await response.json();
      const rates = data[0].rates;
      const usd = rates.find(r => r.code === "USD")?.mid || 1;
      const eur = rates.find(r => r.code === "EUR")?.mid || 1;
      setLocalRates({ USD: usd, EUR: eur, PLN: 1 });
    } catch (error) {
      console.error("Błąd pobierania kursów NBP dla Guest Mode:", error);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (user) {
      try {
        const currencyCode = getCurrencyCode();
        const response = await fetch(`http://localhost:5109/api/transaction/summary?targetCurrency=${currencyCode}`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setSummary(data);
        }
      } catch (error) {
        console.error("Błąd API summary:", error);
      }
    }
  }, [user]);

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
          fetchSummary();
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
    fetchNBPRates(); // Pobierz kursy z sieci dla trybu gościa
  }, [user, fetchSummary, fetchNBPRates]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);
    fetchHistory();
  }, [user, fetchHistory]);

  // --- UNIWERSALNA LOGIKA KURSÓW ---
  const rates = useMemo(() => {
    if (user) {
      const rawIncome = transactions.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
      const rawExpense = transactions.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
      return {
        income: rawIncome > 0 ? summary.totalIncome / rawIncome : 1,
        expense: rawExpense > 0 ? summary.totalExpense / rawExpense : 1
      };
    } else {
      // Logika dla localStorage (uproszczona na podstawie kursu bazowego PLN)
      const targetCode = getCurrencyCode();
      const targetMid = localRates[targetCode] || 1;
      
      return {
        calc: (amount, fromCode) => {
          const fromMid = localRates[fromCode] || 1;
          return (amount * fromMid) / targetMid;
        }
      };
    }
  }, [transactions, summary, user, localRates]);

  const getConvertedAmount = (transaction) => {
    if (user) {
      const rate = transaction.type === "Income" ? rates.income : rates.expense;
      return transaction.amount * rate;
    }
    return rates.calc(transaction.amount, transaction.currency || "USD");
  };

  // --- FILTROWANIE ---
  const filteredTransactions = transactions.filter(t => {
    const convertedAmount = getConvertedAmount(t);
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
              {t.type === "Income" ? "+" : "-"} {currencySymbol} {getConvertedAmount(t).toFixed(2)}
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