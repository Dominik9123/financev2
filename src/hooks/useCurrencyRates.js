import { useCallback, useEffect, useState } from "react";
import { fetchCurrencyRates } from "../services/currencyService";

export function useCurrencyRates() {
  const [rates, setRates] = useState({ PLN: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setRates(await fetchCurrencyRates());
    } catch (error) {
      console.error("Błąd pobierania kursów NBP:", error);
      setError("Nie udało się pobrać kursów walut.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rates, loading, error, reload };
}
