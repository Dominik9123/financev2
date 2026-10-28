export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (
    !Number.isFinite(fromRate) ||
    !Number.isFinite(toRate) ||
    fromRate <= 0 ||
    toRate <= 0
  ) {
    throw new Error("Brak poprawnego kursu waluty.");
  }

  return amount * fromRate / toRate;
}

export function convertTransactions(transactions, targetCurrency, rates) {
  if (!Number.isFinite(rates[targetCurrency])) {
    throw new Error("Nieobsługiwana waluta docelowa.");
  }

  return transactions.map(transaction => {
    if (!Number.isFinite(transaction.amount)) {
      throw new Error("Niepoprawna kwota transakcji.");
    }

    return {
      ...transaction,
      amount: convertCurrency(
        transaction.amount,
        transaction.currency,
        targetCurrency,
        rates
      ),
      currency: targetCurrency
    };
  });
}
