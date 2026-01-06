import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import "./ChartsRow.scss";
import { 
  FaMoneyBillWave, 
  FaShoppingCart, 
  FaHistory, 
  FaArrowUp, 
  FaArrowDown,
  FaCalendarAlt
} from "react-icons/fa";

const ChartsRow = ({ salaries, expenseList, currency, totalIncome, totalExpense }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // --- LOGIKA PRZELICZANIA KURSÓW ---
  // Obliczamy kursy na podstawie danych przesłanych z Dashboardu
  const incomeRate = useMemo(() => {
    const rawIncome = salaries.reduce((sum, s) => sum + s.amount, 0);
    return rawIncome > 0 ? totalIncome / rawIncome : 1;
  }, [salaries, totalIncome]);

  const expenseRate = useMemo(() => {
    const rawExpense = expenseList.reduce((sum, e) => sum + e.amount, 0);
    return rawExpense > 0 ? totalExpense / rawExpense : 1;
  }, [expenseList, totalExpense]);

  // Filtrowanie miesięczne z uwzględnieniem przelicznika
  const filteredIncomes = salaries.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const filteredExpenses = expenseList.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const recentTransactions = [
    ...salaries.map(s => ({ ...s, type: 'income', rate: incomeRate })),
    ...expenseList.map(e => ({ ...e, type: 'expense', rate: expenseRate }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div className="charts-row-container">
      <div className="charts-row">
        {/* TOTAL INCOME BOX */}
        <div className="chart-box">
          <h3><FaMoneyBillWave style={{color: "#c26f02"}} /> Total Income</h3>
          <p className="amount income-amount">
            {currency.split(' ')[1] || currency.split(' ')[0]} {totalIncome.toFixed(2)}
          </p>
          <Line
            data={{
              labels: salaries.map(s => s.date),
              datasets: [{
                data: salaries.map(s => s.amount * incomeRate),
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

        {/* TOTAL SPENDINGS BOX */}
        <div className="chart-box">
          <h3><FaShoppingCart style={{color: "#c26f02"}} /> Total Spendings</h3>
          <p className="amount spending-amount">
            {currency.split(' ')[1] || currency.split(' ')[0]} {totalExpense.toFixed(2)}
          </p>
          <Line
            data={{
              labels: expenseList.map(e => e.date),
              datasets: [{
                data: expenseList.map(e => e.amount * expenseRate),
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

      <div className="month-selector-container">
          <div className="month-selector-box">
            <FaCalendarAlt className="calendar-icon" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="month-dropdown"
            >
              {months.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <span className="year-label">{selectedYear}</span>
          </div>
      </div>

      <div className="dashboard-details-row">
        <div className="monthly-summary-column">
          <div className="mini-card income-accent">
            <span className="label">Income ({months[selectedMonth]})</span>
            <h4 className="value">
              {currency.split(' ')[1] || currency.split(' ')[0]} {(filteredIncomes.reduce((sum, s) => sum + s.amount, 0) * incomeRate).toFixed(2)}
            </h4>
          </div>
          <div className="mini-card expense-accent">
            <span className="label">Spendings ({months[selectedMonth]})</span>
            <h4 className="value">
              {currency.split(' ')[1] || currency.split(' ')[0]} {(filteredExpenses.reduce((sum, e) => sum + e.amount, 0) * expenseRate).toFixed(2)}
            </h4>
          </div>
        </div>

        <div className="recent-transactions-box">
          <h3 className="section-title"><FaHistory /> Recent Activity</h3>
          <div className="transaction-mini-list">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((t, index) => (
                <div key={index} className="mini-t-item">
                  <div className={`t-icon ${t.type}`}>
                    {t.type === 'income' ? <FaArrowUp /> : <FaArrowDown />}
                  </div>
                  <div className="t-info">
                    <p className="t-name">{t.category || "General"}</p>
                    <p className="t-date">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                  <p className={`t-amount-val ${t.type}`}>
                    {t.type === 'income' ? '+' : '-'} {(t.amount * t.rate).toFixed(2)} {currency.split(' ')[1] || currency.split(' ')[0]}
                  </p>
                </div>
              ))
            ) : (
              <p className="no-data-text">No activity found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartsRow;