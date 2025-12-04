import React from "react";
import { Line } from "react-chartjs-2";
import "./ChartsRow.scss";
import { FaMoneyBillWave, FaShoppingCart } from "react-icons/fa";

const ChartsRow = ({ salaries, expenseList, currency }) => {
  return (
    <div className="charts-row">

      {/* INCOME CARD */}
      <div className="chart-box">
        <h3><FaMoneyBillWave style={{color: "#c26f02"}} /> Income</h3>
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

      {/* SPENDINGS CARD */}
      <div className="chart-box">
        <h3><FaShoppingCart style={{color: "#c26f02"}} /> Spendings</h3>
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
  );
};

export default ChartsRow;
