import React, { useState, useEffect, useCallback } from "react";
import { Bar } from "react-chartjs-2";
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

  // --- KOMUNIKACJA Z API (TRANSAKCJE) ---
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
    const savedSalaries = JSON.parse(localStorage.getItem("salaries") || "[]");
    const savedExpenses = JSON.parse(localStorage.getItem("expenses") || "[]");
    setSalaries(savedSalaries);
    setExpenseList(savedExpenses);
  }, [user]);

  // --- KOMUNIKACJA Z API (KATEGORIE) ---
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
      } catch (error) {
        console.error("Błąd API kategorii:", error);
      }
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

  useEffect(() => {
    const totalIncome = salaries.reduce((sum, s) => sum + s.amount, 0);
    const totalExpenses = expenseList.reduce((sum, e) => sum + e.amount, 0);
    setTotalBalance(totalIncome - totalExpenses);
  }, [salaries, expenseList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!salary || !date) return;

    const newTransaction = {
      title: "Salary Payout",
      amount: Number(salary),
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
    const newExpenses = Object.entries(expenses)
      .filter(([_, amount]) => amount)
      .map(([category, amount]) => ({
        title: `Expense: ${category}`,
        category,
        amount: Number(amount),
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

  // --- WYKRESY ---
  const colors = ["#c26f02", "#0277c2"];
  const visibleSalaries = salaries.slice(-5);
  const chartData = {
    labels: visibleSalaries.length > 0 ? visibleSalaries.map(s => new Date(s.date).toLocaleDateString()) : ["No Data"],
    datasets: [{
      label: `Income (${currency})`,
      data: visibleSalaries.length > 0 ? visibleSalaries.map(s => s.amount) : [0],
      backgroundColor: visibleSalaries.map((_, index) => colors[index % colors.length]),
      borderColor: "#a55b00",
      borderWidth: 1,
    }],
  };

  const aggregatedExpenses = expenseList.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  const expenseLabels = Object.keys(aggregatedExpenses);
  const expenseAmounts = Object.values(aggregatedExpenses);
  const barExpenseData = {
    labels: expenseLabels,
    datasets: [{
      label: `Expenses (${currency})`,
      data: expenseAmounts,
      backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0", "#FF9800", "#E91E63", "#3F51B5", "#00BCD4", "#8BC34A"],
      borderColor: '#fff', 
      borderWidth: 1,
    }],
  };

  const barOptions = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#ffffff' } },
      title: { display: true, text: 'Expenses by Category', color: '#ffffff' },
    },
    scales: {
      x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
      y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
    }
  };

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
            {currency} {totalBalance.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="chart-container" style={{height: '300px'}}><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
      <ChartsRow salaries={salaries} expenseList={expenseList} currency={currency} />
      
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
      <div className="chart-container" style={{ height: `${Math.max(expenseLabels.length * 60 + 100, 300)}px` }}><Bar data={barExpenseData} options={barOptions} /></div>
    </div>
  );
};

export default Dashboard;