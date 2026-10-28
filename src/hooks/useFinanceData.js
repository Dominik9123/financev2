import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, fetchApiList } from "../services/financeApi";

export function readStoredArray(key) {
  const value = JSON.parse(localStorage.getItem(key) || "[]");
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`Invalid local data: ${key}`);
  }
  return value;
}

function readGuestTransactions() {
  const incomes = readStoredArray("salaries").map(transaction => ({
    ...transaction,
    type: "Income",
    category: "Income",
    currency: transaction.currency || "USD",
  }));
  const expenses = readStoredArray("expenses").map(transaction => ({
    ...transaction,
    type: "Expense",
    currency: transaction.currency || "USD",
  }));
  return [...incomes, ...expenses];
}

function readGuestCategories() {
  return readStoredArray("customCategories");
}

function useFinanceCollection(user, path, readGuestData) {
  const requestVersion = useRef(0);
  const active = useRef(false);
  const currentOwner = useRef(user);
  currentOwner.current = user;
  const [state, setState] = useState({
    owner: user,
    data: [],
    loading: true,
    error: "",
  });

  const reload = useCallback(async () => {
    if (!active.current || currentOwner.current !== user) return false;
    const version = ++requestVersion.current;
    setState({ owner: user, data: [], loading: true, error: "" });

    try {
      // An account request must never fall back to guest storage after an error.
      const data = user ? await fetchApiList(path) : readGuestData();
      if (version !== requestVersion.current) return false;
      setState({ owner: user, data, loading: false, error: "" });
      return true;
    } catch (error) {
      if (version !== requestVersion.current) return false;
      setState({
        owner: user,
        data: [],
        loading: false,
        error: apiErrorMessage(error, user
          ? "Could not load account data. Please try again."
          : "Could not read local data. Your saved data has not been deleted."),
      });
      return false;
    }
  }, [user, path, readGuestData]);

  useEffect(() => {
    active.current = true;
    reload();
    return () => {
      active.current = false;
      // Ignore responses from a previous session or an unmounted page.
      requestVersion.current += 1;
    };
  }, [reload]);

  if (state.owner !== user) {
    return { data: [], loading: true, error: "", reload };
  }
  return { ...state, reload };
}

export function useTransactions(user) {
  return useFinanceCollection(user, "/transaction", readGuestTransactions);
}

export function useCategories(user) {
  return useFinanceCollection(user, "/category", readGuestCategories);
}
