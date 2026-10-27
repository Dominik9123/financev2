import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import ChartsRow from "../components/ChartsRow";
import "../components/ChartsRow.scss";
import { convertCurrency } from "../utils/convertCurrency";
import { fetchCurrencyRates } from "../services/currencyService";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from "chart.js";

import {
  FaHome, FaUtensils, FaCar, FaTheaterMasks, FaShoppingCart,
  FaBriefcaseMedical, FaPlane, FaChartLine, FaBook, FaMoneyBillWave, FaFolderOpen
} from "react-icons/fa";

import "./Dashboard.scss";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Tooltip, Legend, Title
);

const categories = [
  { name: "Housing", icon: <FaHome /> },
  { name: "Food", icon: <FaUtensils /> },
  { name: "Transport", icon: <FaCar /> },
  { name: "Entertainment", icon: <FaTheaterMasks /> },
  { name: "Shopping", icon: <FaShoppingCart /> },
  { name: "HealthCare", icon: <FaBriefcaseMedical /> },
  { name: "Travel", icon: <FaPlane /> },
  { name: "Savings", icon: <FaChartLine /> },
  { name: "Education", icon: <FaBook /> },
  { name: "Debt's", icon: <FaMoneyBillWave /> },
];

const Dashboard = ({ user }) => {
  const [salary, setSalary] = useState("");
  const [date, setDate] = useState("");
  const [salaries, setSalaries] = useState([]);
  const [currency, setCurrency] = useState("USD ($)");
  const [expenses, setExpenses] = useState({});
  const [expenseList, setExpenseList] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  
  // Stan dla podsumowania z API (zalogowany) i kursów NBP (gość)
  const [localRates, setLocalRates] = useState({ PLN: 1 });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");

  const getCurrencyCode = () => {
    return (localStorage.getItem("currency") || "USD ($)").split(" ")[0];
  };

  // --- POBIERANIE KURSÓW  ---
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


  const fetchTransactions = useCallback(async () => {
    if (user) {
      try {
        const response = await fetch("http://localhost:5109/api/transaction", {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setSalaries(data.filter(t => t.type === "Income"));
          setExpenseList(data.filter(t => t.type === "Expense"));
          return;
        }
      } catch (error) {
        console.error("Błąd API transakcji:", error);
      }
    }
    
    // Tryb Gość
    const savedSalaries = JSON.parse(localStorage.getItem("salaries") || "[]").map(t => ({...t, currency: t.currency || "USD"}));
    const savedExpenses = JSON.parse(localStorage.getItem("expenses") || "[]").map(t => ({...t, currency: t.currency || "USD"}));
    setSalaries(savedSalaries);
    setExpenseList(savedExpenses);
}, [user]);

  const fetchCategories = useCallback(async () => {
    if (user) {
      try {
        const response = await fetch("http://localhost:5109/api/category", {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCustomCategories(data);
          return;
        }
      } catch (error) {}
    }
    const saved = JSON.parse(localStorage.getItem("customCategories") || "[]");
    setCustomCategories(saved);
  }, [user]);

   useEffect(() => {
    fetchNBPRates();
  }, [fetchNBPRates]);

useEffect(() => {
  const savedCurrency = localStorage.getItem("currency") || "USD ($)";
  setCurrency(savedCurrency);
  fetchTransactions();
  fetchCategories();
}, [user, fetchTransactions, fetchCategories]);

  // --- UNIWERSALNA LOGIKA PRZELICZANIA (GOŚĆ + ZALOGOWANY) ---
  const conversion = useMemo(() => {
  if (ratesLoading || ratesError) {
    return null;
  }

  try {
    const targetCode = currency.split(" ")[0];

    if (!Number.isFinite(localRates[targetCode])) {
      throw new Error("Nieobsługiwana waluta docelowa.");
    }

    const convertTransaction = transaction => {
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
    };

    const convertedSalaries = salaries.map(convertTransaction);
    const convertedExpenses = expenseList.map(convertTransaction);

    const totalIncome = convertedSalaries.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    );

    const totalExpense = convertedExpenses.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    );

    return {
      salaries: convertedSalaries,
      expenseList: convertedExpenses,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  } catch {
    return {
      error: "Nie można przeliczyć transakcji. Sprawdź ich kwoty i waluty."
    };
  }
}, [salaries, expenseList, currency, localRates, ratesLoading, ratesError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!salary || !date) return;

    const newTransaction = {
      title: "Salary Payout",
      amount: Number(salary),
      currency: getCurrencyCode(),
      category: "Income",
      type: "Income",
      date: new Date(date).toISOString()
    };

    if (user) {
      try {
        await fetch("http://localhost:5109/api/transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTransaction),
          credentials: "include"
        });
      } catch (error) {}
    } else {
      const updated = [...salaries, { ...newTransaction, date: date }];
      localStorage.setItem("salaries", JSON.stringify(updated));
    }

    setSalary("");
    setDate("");
    fetchTransactions();
  };

  const handleExpenseSubmit = async () => {
    const currencyCode = getCurrencyCode();
    const newExpenses = Object.entries(expenses)
      .filter(([_, amount]) => amount)
      .map(([category, amount]) => ({
        title: `Expense: ${category}`,
        category,
        amount: Number(amount),
        currency: currencyCode,
        type: "Expense",
        date: new Date().toISOString()
      }));

    if (user) {
      for (const item of newExpenses) {
        await fetch("http://localhost:5109/api/transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
          credentials: "include"
        });
      }
    } else {
      const currentLocal = JSON.parse(localStorage.getItem("expenses") || "[]");
      const updated = [...currentLocal, ...newExpenses];
      localStorage.setItem("expenses", JSON.stringify(updated));
    }

    setExpenses({});
    fetchTransactions();
  };

  const handleExpenseChange = (category, amount) => {
    setExpenses(prev => ({ ...prev, [category]: amount }));
  };
  if (ratesLoading) {
  return (
    <div className="dashboard">
      <p role="status">Pobieranie kursów walut…</p>
    </div>
  );
}

if (ratesError) {
  return (
    <div className="dashboard">
      <p role="alert">{ratesError}</p>
      <button type="button" onClick={fetchNBPRates}>
        Spróbuj ponownie
      </button>
    </div>
  );
}
  // --- DANE DO WYKRESÓW (PRZELICZONE) ---
  if (conversion.error) {
  return (
    <div className="dashboard">
      <p role="alert">{conversion.error}</p>
    </div>
  );
}
  const visibleSalaries = [...conversion.salaries]
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .slice(-10);
  const chartData = {
    labels: visibleSalaries.length > 0 ? visibleSalaries.map(s => new Date(s.date).toLocaleDateString()) : ["No Data"],
    datasets: [{
      label: `Income History (${currency})`,
      data: visibleSalaries.map(s => s.amount),
      borderColor: "#4caf50", 
      backgroundColor: "rgba(76, 175, 80, 0.1)", 
      borderWidth: 3,
      fill: true, tension: 0.4,
    }],
  };

  const aggregatedExpenses = conversion.expenseList.reduce((acc, curr) => {
  acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
  return acc;
}, {});

  const barExpenseData = {
    labels: Object.keys(aggregatedExpenses),
    datasets: [{
      label: `Expenses (${currency})`,
      data: Object.values(aggregatedExpenses),
      backgroundColor: ["rgba(194, 111, 2, 0.7)", "rgba(76, 175, 80, 0.6)", "rgba(255, 82, 82, 0.6)", "rgba(52, 152, 219, 0.6)"],
      borderWidth: 2,
    }],
  };

  const currencySymbol = currency.split(' ')[1] || currency.split(' ')[0];

  return (
    <div className="dashboard">
      <h1 className="outlined-text">Dashboard</h1>
      <form onSubmit={handleSubmit}>
        <label className="label-text">Salary Amount:</label>
        <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Enter Amount:" required min="0" />
        <label className="label-text">Date:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button type="submit" className="button-payout">Add Payout</button>
      </form>
      <div className="balance-wrapper">
        <div className="balance-container">
          <h3>Total Balance 💵</h3>
          <p
            className={`balance-amount ${
              conversion.balance < 0 ? "negative" : "positive"
            }`}
          >
            {currencySymbol} {conversion.balance.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="chart-container" style={{height: '300px'}}>
        <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
      </div>
      
      <ChartsRow 
        salaries={conversion.salaries}
        expenseList={conversion.expenseList}
        currency={currency} 
        totalIncome={conversion.totalIncome} 
        totalExpense={conversion.totalExpense} 
      />
      
      <h2 className="outlined-text expense-title">Add Expense</h2>
      <div className="expense-grid">
        {categories.concat(customCategories).map(({ name, icon }) => (
          <div key={name} className="expense-tile">
            <div className="expense-icon">{icon ? icon : <FaFolderOpen />}</div>
            <span>{name}</span>
            <input type="number" value={expenses[name] || ""} onChange={(e) => handleExpenseChange(name, e.target.value)} placeholder="Amount :" min="0" />
          </div>
        ))}
      </div>
      <button className="expense-submit-button" onClick={handleExpenseSubmit}>Add Expense</button>
      <div className="chart-container" style={{ height: '400px' }}><Bar data={barExpenseData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false }} /></div>
    </div>
  );
};

export default Dashboard;