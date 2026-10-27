export async function fetchCurrencyRates() {
  const response = await fetch(
    "https://api.nbp.pl/api/exchangerates/tables/A/?format=json"
  );

  if (!response.ok) {
    throw new Error(`Błąd pobierania kursów: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rates = data[0]?.rates;

  if (!Array.isArray(rates)) {
    throw new Error("Niepoprawny format danych z NBP.");
  }

  const supportedCurrencies = ["USD", "EUR", "GBP", "JPY"];
  const newRates = { PLN: 1 };

  for (const code of supportedCurrencies) {
    const rate = rates.find(item => item.code === code)?.mid;

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Brak poprawnego kursu dla ${code}.`);
    }

    newRates[code] = rate;
  }

  return newRates;
}