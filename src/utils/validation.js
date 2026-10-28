export const defaultCategoryNames = [
  "Housing", "Food", "Transport", "Entertainment", "Shopping",
  "HealthCare", "Travel", "Savings", "Education", "Debt's"
];

export function normalizeCategoryName(name) {
  return name.trim().normalize("NFC");
}

export function categoryExists(name, customCategories) {
  const key = normalizeCategoryName(name).toUpperCase();
  return [...defaultCategoryNames, "Income", "All", ...customCategories.map(category => category.name)]
    .some(existing => normalizeCategoryName(existing).toUpperCase() === key);
}

export function isValidAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0.01 && amount <= 1000000000
    && Number(amount.toFixed(2)) === amount;
}

export function getPasswordRequirements(password) {
  return {
    length: password.length >= 8 && password.length <= 128,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isValidPassword(password) {
  return Object.values(getPasswordRequirements(password)).every(Boolean);
}
