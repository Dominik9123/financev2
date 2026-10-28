import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Bar, Line } from "react-chartjs-2";
import ChartsRow from "../components/ChartsRow";
import "../components/ChartsRow.scss";
import { convertCurrency } from "../utils/convertCurrency";
import { fetchCurrencyRates } from "../services/currencyService";
import { toast } from "react-toastify";
import { apiErrorMessage, postJson } from "../services/financeApi";
import { readStoredArray, useCategories, useTransactions } from "../hooks/useFinanceData";
import { categoryExists, defaultCategoryNames, isValidAmount } from "../utils/validation";
import { useSessionGuard } from "../hooks/useSession";

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

const categoryIcons = {
  Housing: FaHome, Food: FaUtensils, Transport: FaCar,
  Entertainment: FaTheaterMasks, Shopping: FaShoppingCart,
  HealthCare: FaBriefcaseMedical, Travel: FaPlane, Savings: FaChartLine,
  Education: FaBook, "Debt's": FaMoneyBillWave,
};
const categories = defaultCategoryNames.map(name => ({ name, icon: React.createElement(categoryIcons[name]) }));

const Dashboard = ({ user }) => {
  const [salary, setSalary] = useState("");
  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState("USD ($)");
  const [expenses, setExpenses] = useState({});
  const transactions = useTransactions(user);
  const reloadTransactions = useRef(transactions.reload);
  reloadTransactions.current = transactions.reload;
  const categoryData = useCategories(user);
  const salaries = useMemo(() => transactions.data.filter(t => t.type === "Income"), [transactions.data]);
  const expenseList = useMemo(() => transactions.data.filter(t => t.type === "Expense"), [transactions.data]);
  const customCategories = categoryData.data;
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const { isCurrent, isSameSession, canWrite, reportSessionError, expired } = useSessionGuard(user);

  // Kursy walut są wspólne dla konta i trybu gościa.
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


   useEffect(() => {
    fetchNBPRates();
  }, [fetchNBPRates]);

useEffect(() => {
  const savedCurrency = localStorage.getItem("currency") || "USD ($)";
  setCurrency(savedCurrency);
}, [user]);

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
    if (saving.current || !canWrite()) return;
    if (!isValidAmount(salary) || !date || Number.isNaN(new Date(date).getTime()) || date === "0001-01-01") {
      toast.error("Enter an amount between 0.01 and 1,000,000,000 with at most two decimal places, and a valid date.");
      return;
    }

    const newTransaction = {
      title: "Salary Payout",
      amount: Number(salary),
      currency: getCurrencyCode(),
      category: "Income",
      type: "Income",
      date: new Date(date).toISOString()
    };

    saving.current = true;
    setIsSaving(true);
    try {
      if (user) {
        await postJson("/transaction", newTransaction);
      } else {
        const updated = [...readStoredArray("salaries"), { ...newTransaction, date }];
        localStorage.setItem("salaries", JSON.stringify(updated));
      }
      if (!isCurrent()) return;
      setSalary("");
      setDate("");
      toast.success("Income saved successfully.");
      await reloadTransactions.current();
    } catch (error) {
      if (!isSameSession()) return;
      reportSessionError(error);
      const message = apiErrorMessage(error, "Could not save income. Your form has been preserved.");
      toast.error(error.status === 0 ? `${message} Check history before retrying to avoid a duplicate.` : message);
    } finally {
      saving.current = false;
      if (isCurrent()) setIsSaving(false);
    }
  };

  const handleExpenseSubmit = async () => {
    if (saving.current || !canWrite()) return;
    const currencyCode = getCurrencyCode();
    const newExpenses = Object.entries(expenses)
      .filter(([_, amount]) => amount !== "")
      .map(([category, amount]) => ({
        title: `Expense: ${category}`,
        category,
        amount: Number(amount),
        currency: currencyCode,
        type: "Expense",
        date: new Date().toISOString()
      }));

    if (newExpenses.length === 0 || newExpenses.some(item => !isValidAmount(item.amount))) {
      toast.error("Enter an amount between 0.01 and 1,000,000,000 with at most two decimal places for each expense.");
      return;
    }

    saving.current = true;
    setIsSaving(true);
    let savedCount = 0;
    try {
      if (user) {
        for (const item of newExpenses) {
          if (!canWrite()) return;
          await postJson("/transaction", item);
          if (!isCurrent()) return;
          savedCount += 1;
          // Clear only confirmed entries so retrying a partial batch cannot resend them.
          setExpenses(previous => {
            const remaining = { ...previous };
            delete remaining[item.category];
            return remaining;
          });
        }
      } else {
        const updated = [...readStoredArray("expenses"), ...newExpenses];
        localStorage.setItem("expenses", JSON.stringify(updated));
        savedCount = newExpenses.length;
        setExpenses({});
      }
      toast.success("Expenses saved successfully.");
    } catch (error) {
      if (!isSameSession()) return;
      reportSessionError(error);
      const detail = apiErrorMessage(error, "Could not save all expenses.");
      toast.error(`${savedCount ? `${savedCount} expense(s) saved. ` : ""}${detail} Unconfirmed amounts remain in the form. Check history before retrying.`);
    } finally {
      if (savedCount > 0 && isCurrent()) await reloadTransactions.current();
      saving.current = false;
      if (isCurrent()) setIsSaving(false);
    }
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
      {transactions.loading && <p role="status">Loading transactions…</p>}
      {transactions.error && (
        <div role="alert">
          <p>{transactions.error}</p>
          <button type="button" onClick={transactions.reload}>Retry transactions</button>
        </div>
      )}
      {categoryData.error && (
        <div role="alert">
          <p>{categoryData.error}</p>
          <button type="button" onClick={categoryData.reload}>Retry categories</button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label className="label-text">Salary Amount:</label>
        <input aria-label="Salary amount" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Enter Amount:" required min="0.01" max="1000000000" step="0.01" disabled={isSaving || expired} />
        <label className="label-text">Date:</label>
        <input aria-label="Income date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={isSaving || expired} />
        <button type="submit" className="button-payout" disabled={isSaving || expired || transactions.loading || !!transactions.error}>Add Payout</button>
      </form>
      {!transactions.loading && !transactions.error && <>
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
      </>}
      
      <h2 className="outlined-text expense-title">Add Expense</h2>
      <div className="expense-grid">
        {categories.concat(customCategories.filter(category => !categoryExists(category.name, []))).map(({ name, icon }) => (
          <div key={name} className="expense-tile">
            <div className="expense-icon">{icon ? icon : <FaFolderOpen />}</div>
            <span>{name}</span>
            <input aria-label={`${name} amount`} type="number" value={expenses[name] || ""} onChange={(e) => handleExpenseChange(name, e.target.value)} placeholder="Amount :" min="0.01" max="1000000000" step="0.01" disabled={isSaving || expired} />
          </div>
        ))}
      </div>
      <button className="expense-submit-button" onClick={handleExpenseSubmit} disabled={isSaving || expired || transactions.loading || !!transactions.error || categoryData.loading || !!categoryData.error}>Add Expense</button>
      {!transactions.loading && !transactions.error && <div className="chart-container" style={{ height: '400px' }}><Bar data={barExpenseData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false }} /></div>}
    </div>
  );
};

export default Dashboard;
