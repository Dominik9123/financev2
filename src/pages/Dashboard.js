import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import ChartsRow from "../components/ChartsRow";
import "../components/ChartsRow.scss";

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
  const [totalBalance, setTotalBalance] = useState(0);
  const [currency, setCurrency] = useState("USD ($)");
  const [expenses, setExpenses] = useState({});
  const [expenseList, setExpenseList] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  
  // Stan dla podsumowania z API (zalogowany) i kursów NBP (gość)
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [localRates, setLocalRates] = useState({ USD: 1, EUR: 1, PLN: 1 });

  const getCurrencyCode = () => {
    return (localStorage.getItem("currency") || "USD ($)").split(" ")[0];
  };

  // --- POBIERANIE KURSÓW DLA TRYBU GOŚCIA ---
  const fetchNBPRates = useCallback(async () => {
    try {
      const response = await fetch("https://api.nbp.pl/api/exchangerates/tables/A/?format=json");
      const data = await response.json();
      const rates = data[0].rates;
      const usd = rates.find(r => r.code === "USD")?.mid || 1;
      const eur = rates.find(r => r.code === "EUR")?.mid || 1;
      setLocalRates({ USD: usd, EUR: eur, PLN: 1 });
    } catch (error) {
      console.error("Błąd pobierania kursów NBP:", error);
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
          setTotalBalance(data.balance);
        }
      } catch (error) {
        console.error("Błąd API summary:", error);
      }
    }
  }, [user]);

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
          fetchSummary(); 
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
    fetchNBPRates();
  }, [user, fetchSummary, fetchNBPRates]);

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
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);
    fetchTransactions();
    fetchCategories();
  }, [user, fetchTransactions, fetchCategories]);

  // --- UNIWERSALNA LOGIKA PRZELICZANIA (GOŚĆ + ZALOGOWANY) ---
  const conversion = useMemo(() => {
    const targetCode = getCurrencyCode();
    
    if (user) {
      // Dla zalogowanego używamy kursu wyliczonego z backendu
      const rawInc = salaries.reduce((sum, s) => sum + s.amount, 0);
      const rawExp = expenseList.reduce((sum, e) => sum + e.amount, 0);
      return {
        incomeRate: rawInc > 0 ? summary.totalIncome / rawInc : 1,
        expenseRate: rawExp > 0 ? summary.totalExpense / rawExp : 1,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        balance: summary.balance,
        calc: (amount, rate) => amount * rate
      };
    } else {
      // Dla gościa używamy kursów NBP
      const targetMid = localRates[targetCode] || 1;
      const calc = (amount, fromCode) => {
        const fromMid = localRates[fromCode || "USD"] || 1;
        return (amount * fromMid) / targetMid;
      };
      
      const totalInc = salaries.reduce((sum, s) => sum + calc(s.amount, s.currency), 0);
      const totalExp = expenseList.reduce((sum, e) => sum + calc(e.amount, e.currency), 0);
      
      return {
        incomeRate: 1, 
        expenseRate: 1,
        totalIncome: totalInc,
        totalExpense: totalExp,
        balance: totalInc - totalExp,
        calc: calc
      };
    }
  }, [salaries, expenseList, summary, localRates, user]);

  useEffect(() => {
    setTotalBalance(conversion.balance);
  }, [conversion.balance]);

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

  // --- DANE DO WYKRESÓW (PRZELICZONE) ---
  const visibleSalaries = salaries.slice(-10); 
  const chartData = {
    labels: visibleSalaries.length > 0 ? visibleSalaries.map(s => new Date(s.date).toLocaleDateString()) : ["No Data"],
    datasets: [{
      label: `Income History (${currency})`,
      data: visibleSalaries.map(s => user ? s.amount * conversion.incomeRate : conversion.calc(s.amount, s.currency)),
      borderColor: "#4caf50", 
      backgroundColor: "rgba(76, 175, 80, 0.1)", 
      borderWidth: 3,
      fill: true, tension: 0.4,
    }],
  };

  const aggregatedExpenses = expenseList.reduce((acc, curr) => {
    const convertedAmount = user ? curr.amount * conversion.expenseRate : conversion.calc(curr.amount, curr.currency);
    acc[curr.category] = (acc[curr.category] || 0) + convertedAmount;
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
          <p className={`balance-amount ${totalBalance < 0 ? "negative" : "positive"}`}>
            {currencySymbol} {totalBalance.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="chart-container" style={{height: '300px'}}>
        <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
      </div>
      
      <ChartsRow 
        salaries={salaries} 
        expenseList={expenseList} 
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