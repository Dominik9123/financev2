import React, { useState, useEffect } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";

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
  FaHome,
  FaUtensils,
  FaCar,
  FaTheaterMasks,
  FaShoppingCart,
  FaBriefcaseMedical,
  FaPlane,
  FaChartLine,
  FaBook,
  FaMoneyBillWave,
  FaFolderOpen
} from "react-icons/fa";

import "./Dashboard.scss";


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
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

const Dashboard = () => {
  const [salary, setSalary] = useState("");
  const [date, setDate] = useState("");
  const [salaries, setSalaries] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [currency, setCurrency] = useState("USD ($)");

  const [expenses, setExpenses] = useState({});
  const [expenseList, setExpenseList] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);

  useEffect(() => {
    const savedCustomCategories = JSON.parse(localStorage.getItem("customCategories") || "[]");
    setCustomCategories(savedCustomCategories);

    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setCurrency(savedCurrency);

    const savedSalaries = JSON.parse(localStorage.getItem("salaries") || "[]");
    const savedExpenses = JSON.parse(localStorage.getItem("expenses") || "[]");

    setSalaries(savedSalaries);
    setExpenseList(savedExpenses);
  }, []);

  useEffect(() => {
    const totalIncome = salaries.reduce((sum, s) => sum + s.amount, 0);
    const totalExpenses = expenseList.reduce((sum, e) => sum + e.amount, 0);

    setTotalBalance(prevBalance => {
      const newBalance = totalIncome - totalExpenses;
      return prevBalance !== newBalance ? newBalance : prevBalance;
    });
  }, [salaries, expenseList]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!salary || !date) return;

    const newSalary = { amount: Number(salary), date };
    const updatedSalaries = [...salaries, newSalary];

    localStorage.setItem("salaries", JSON.stringify(updatedSalaries));
    setSalaries(updatedSalaries);

    const updatedTotal = updatedSalaries.reduce((sum, s) => sum + s.amount, 0);
    setTotalBalance(updatedTotal);

    setSalary("");
    setDate("");
  };

  const handleExpenseChange = (category, amount) => {
    setExpenses(prevExpenses => ({
      ...prevExpenses,
      [category]: amount,
    }));
  };

  const handleExpenseSubmit = () => {
    const newExpenses = Object.entries(expenses)
      .filter(([_, amount]) => amount)
      .map(([category, amount]) => ({
        category,
        amount: Number(amount),
        date: new Date().toISOString().split("T")[0],
      }));

    const updatedExpenseList = [...expenseList, ...newExpenses];

    localStorage.setItem("expenses", JSON.stringify(updatedExpenseList));
    setExpenseList(updatedExpenseList);
    setExpenses({});
  };

  const colors = ["#c26f02", "#0277c2"];
  const visibleSalaries = salaries.slice(-5);

  const data = {
    labels: visibleSalaries.length > 0 ? visibleSalaries.map(s => s.date) : ["No Data"],
    datasets: [
      {
        label: `Income (${currency})`,
        data: visibleSalaries.length > 0 ? visibleSalaries.map(s => s.amount) : [0],
        backgroundColor: visibleSalaries.map((_, index) => colors[index % colors.length]),
        borderColor: "#a55b00",
        borderWidth: 1,
      },
    ],
  };

  const expenseData = {
    labels: expenseList.map(exp => `${exp.category}: ${currency} ${exp.amount}`),
    datasets: [
      {
        data: expenseList.map(exp => exp.amount),
        backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0", "#FF9800", "#E91E63", "#3F51B5", "#00BCD4", "#8BC34A"],
      },
    ],
  };

  return (
    <div className="dashboard">
      <h1 className="outlined-text">Dashboard</h1>

      <form onSubmit={handleSubmit}>
        <label className="label-text">Salary Amount:</label>
        <input 
          type="number" 
          value={salary} 
          onChange={(e) => setSalary(e.target.value)} 
          placeholder="Enter Amount:" 
          required 
          min="0"
        />

        <label className="label-text">Date:</label>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          required 
        />
        <button type="submit" className="button-payout">Add Payout</button>
        <p className="label-text">Clicking on "Income" hides the chart</p>
      </form>

      <div className="balance-wrapper">
        <div className="balance-container">
          <h3>Total Balance 💵</h3>
          <p>{currency} {totalBalance.toFixed(2)}</p>
        </div>
      </div>

      <div className="chart-container">
       <Bar data={data} />
      </div>

      <div className="side-summary">
  <div className="chart-box income-box">
    <h3><FaMoneyBillWave /> Income</h3>
    <p className="amount-text">
      {currency} {salaries.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
    </p>
    <div className="mini-chart">
      <Line 
        data={{
          labels: salaries.map(s => s.date),
          datasets: [{
            data: salaries.map(s => s.amount),
            borderColor: "#ffa600",
            borderWidth: 2,
            fill: false,
            tension: 0.5,
            pointRadius: 0
          }]
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } }
        }}
      />
    </div>
  </div>

  <div className="chart-box spending-box">
    <h3><FaShoppingCart /> Spendings</h3>
    <p className="amount-text">
      {currency} {expenseList.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
    </p>
    <div className="mini-chart">
      <Line 
        data={{
          labels: expenseList.map(e => e.date),
          datasets: [{
            data: expenseList.map(e => e.amount),
            borderColor: "#ff4d6d",
            borderWidth: 2,
            fill: false,
            tension: 0.5,
            pointRadius: 0
          }]
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } }
        }}
      />
    </div>
  </div>
</div>


      <h2 className="outlined-text expense-title">Add Expense</h2>
      <div className="expense-grid">
        {categories.concat(customCategories).map(({ name, icon }) => (
          <div key={name} className="expense-tile">
            <div className="expense-icon">{icon ? icon : <FaFolderOpen />}</div>
            <span>{name}</span>
            <input
              type="number"
              value={expenses[name] || ""}
              onChange={(e) => handleExpenseChange(name, e.target.value)}
              placeholder="Amount :"
              min="0"
            />
          </div>
        ))}
      </div>

      <button className="expense-submit-button" onClick={handleExpenseSubmit}>
        Add Expense
      </button>
      <p className="label-text">Clicking on "Category" hides the part from the chart</p>

      <div className="chart-container">
        <Pie data={expenseData} />
      </div>
    </div>
  );
};

export default Dashboard;
