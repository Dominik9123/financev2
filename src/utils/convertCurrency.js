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
