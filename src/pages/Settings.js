import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { apiErrorMessage, postJson, requestApi } from "../services/financeApi";
import { readStoredArray, useCategories } from "../hooks/useFinanceData";
import { categoryExists, normalizeCategoryName } from "../utils/validation";
import { useSessionGuard } from "../hooks/useSession";
// Import stylów Toastify MUSI być przed Twoim SCSS
import "react-toastify/dist/ReactToastify.css"; 
import "./Settings.scss";

const currencyOptions = ["USD ($)", "EUR (€)", "PLN (zł)", "GBP (£)", "JPY (¥)"];

const Settings = ({ user }) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("USD ($)");
  const categoryData = useCategories(user);
  const reloadCategories = useRef(categoryData.reload);
  reloadCategories.current = categoryData.reload;
  const customCategories = categoryData.data;
  const [newCategory, setNewCategory] = useState("");
  const pending = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const { isCurrent, isSameSession, canWrite, reportSessionError, expired } = useSessionGuard(user);

  // Zaktualizowany config Toasta - dodano theme: "dark"
  const toastConfig = {
    position: "top-right",
    autoClose: 3000,
    theme: "dark", 
  };

  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") || "USD ($)";
    setSelectedCurrency(savedCurrency);
  }, [user]);

  const runAction = async (action, failureMessage) => {
    if (pending.current || !canWrite()) return;
    pending.current = true;
    setIsPending(true);
    try {
      await action();
    } catch (error) {
      if (!isSameSession()) return;
      reportSessionError(error);
      toast.error(apiErrorMessage(error, failureMessage), toastConfig);
    } finally {
      pending.current = false;
      if (isCurrent()) setIsPending(false);
    }
  };

  const handleCurrencyChange = (event) => {
    setSelectedCurrency(event.target.value);
  };

  const handleConfirmCurrency = () => {
    localStorage.setItem("currency", selectedCurrency);
    toast.success(`Currency changed to ${selectedCurrency}! 💰`, toastConfig);
  };

  const handleExport = () => {
    if (!user) return;
    return runAction(async () => {
      const response = await requestApi("/transaction/export");
      const blob = await response.blob();
      if (!isCurrent()) return;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Raport_Finansowy_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully! 📊", toastConfig);
    }, "Could not generate report.");
  };

  const handleAddCategory = async () => {
    const name = normalizeCategoryName(newCategory);
    if (name === "") {
      toast.warning("Category name cannot be empty! ⚠️", toastConfig);
      return;
    }

    if (name.length > 25) {
      toast.warning("Category name cannot exceed 25 characters.", toastConfig);
      return;
    }

    if (categoryExists(name, customCategories)) {
      toast.warning("This category already exists.", toastConfig);
      return;
    }

    return runAction(async () => {
      if (user) {
        await postJson("/category", { name });
      } else {
        const updated = [...readStoredArray("customCategories"), { name }];
        localStorage.setItem("customCategories", JSON.stringify(updated));
      }
      if (!isCurrent()) return;
      setNewCategory("");
      toast.success("Category saved successfully.", toastConfig);
      await reloadCategories.current();
    }, "Could not save category. Your input has been preserved.");
  };

  const handleDeleteCategory = categoryObj => runAction(async () => {
    if (user) {
      if (!categoryObj.id) throw new Error("Missing category ID.");
      await requestApi(`/category/${categoryObj.id}`, {
          method: "DELETE",
      });
    } else {
      const updated = readStoredArray("customCategories").filter(c => c.name !== categoryObj.name);
      localStorage.setItem("customCategories", JSON.stringify(updated));
    }
    if (!isCurrent()) return;
    toast.success("Category removed.", toastConfig);
    await reloadCategories.current();
  }, "Could not delete category. Please try again.");

  const executeReset = () => runAction(async () => {
    if (user) {
      await requestApi("/transaction/reset", {
          method: "DELETE",
      });
    } else {
      localStorage.removeItem("salaries");
      localStorage.removeItem("expenses");
    }
    if (!isCurrent()) return;
    setIsResetModalOpen(false);
    toast.success("Transactions deleted successfully.", toastConfig);
  }, "Could not reset transactions. Please try again.");

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      <p>Customize your experience and preferences</p>

      <label className="settings-label">Choose Currency:</label>
      <select className="currency-select" value={selectedCurrency} onChange={handleCurrencyChange}>
        {currencyOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>

      <button className="confirm-button" onClick={handleConfirmCurrency}>Confirm Currency ✅</button>

      <div className="custom-category-section">
        <label className="settings-label">Add Custom Category:</label>
        <input
          type="text"
          className="category-input"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value.slice(0, 25))}
          maxLength="25"
          aria-label="New category"
          disabled={isPending || expired}
        />
        <button className="category-button" onClick={handleAddCategory} disabled={isPending || expired || categoryData.loading || !!categoryData.error}>Add Category ➕</button>

        {categoryData.loading && <p role="status">Loading categories…</p>}
        {categoryData.error && (
          <div role="alert">
            <p>{categoryData.error}</p>
            <button type="button" onClick={categoryData.reload}>Retry categories</button>
          </div>
        )}

        <ul className="category-list">
          {customCategories.map((category, index) => (
            <li key={category.id || index} className="category-item">
              <span className="category-name">{category.name}</span>
              <button aria-label={`Delete ${category.name}`} onClick={() => handleDeleteCategory(category)} className="delete-button" disabled={isPending || expired}>❌</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="reset-section">
        <div className="button-container">
          <button className="confirm-button" onClick={handleExport} disabled={!user || isPending || expired}>
            Export CSV 📊
          </button>
          
          <button className="reset-button" onClick={() => setIsResetModalOpen(true)} disabled={isPending || expired}>
            {user ? "Reset Account Data 🔄" : "Reset Local Data 🔄"}
          </button>
        </div>
        {!user && <p>CSV export is available after signing in.</p>}
      </div>

      {isResetModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Reset ⚠️</h3>
            <p>Are you sure? This will delete all your transactions. This action cannot be undone!</p>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsResetModalOpen(false)} disabled={isPending}>
                Cancel
              </button>
              <button className="btn-confirm-danger" onClick={executeReset} disabled={isPending || expired}>
                {isPending ? "Deleting…" : "Yes, Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
