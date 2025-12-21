import React, { useState } from "react";
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

const ChartsRow = ({ salaries, expenseList, currency }) => {
  // Stan dla wybranego miesiąca (tylko dla sekcji miesięcznej)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // 1. Filtrowanie danych TYLKO dla kafelków miesięcznych
  const filteredIncomes = salaries.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const filteredExpenses = expenseList.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // 2. Ostatnie 5 transakcji (zawsze ogólne, niezależnie od wybranego miesiąca)
  const recentTransactions = [
    ...salaries.map(s => ({ ...s, type: 'income' })),
    ...expenseList.map(e => ({ ...e, type: 'expense' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div className="charts-row-container">
      
      {/* GÓRNY RZĄD: OGÓLNE PODSUMOWANIE (TRENDY) */}
      <div className="charts-row">
        {/* TOTAL INCOME BOX */}
        <div className="chart-box">
          <h3><FaMoneyBillWave style={{color: "#c26f02"}} /> Total Income</h3>
          <p className="amount income-amount">
            {currency} {salaries.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
          </p>
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

        {/* TOTAL SPENDINGS BOX */}
        <div className="chart-box">
          <h3><FaShoppingCart style={{color: "#c26f02"}} /> Total Spendings</h3>
          <p className="amount spending-amount">
            {currency} {expenseList.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
          </p>
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

      {/* SEKCJA WYBORU MIESIĄCA (tylko dla dołu) */}
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

      {/* DOLNY RZĄD: MIESIĘCZNE PODSUMOWANIE (ZALEŻNE OD SELEKTORA) */}
      <div className="dashboard-details-row">
        
        <div className="monthly-summary-column">
          <div className="mini-card income-accent">
            <span className="label">Income ({months[selectedMonth]})</span>
            <h4 className="value">
              {currency} {filteredIncomes.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
            </h4>
          </div>
          <div className="mini-card expense-accent">
            <span className="label">Spendings ({months[selectedMonth]})</span>
            <h4 className="value">
              {currency} {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
            </h4>
          </div>
        </div>

        {/* LISTA OSTATNICH TRANSAKCJI */}
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
                    {t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)} {currency}
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