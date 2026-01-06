# 💰 Personal Finance Tracker v2.0

[English Version](#english-version-en) | [Wersja Polska](#wersja-polska-pl)

---

## Wersja Polska (PL)

Aplikacja typu Full-Stack do zarządzania finansami osobistymi z **automatycznym przeliczaniem walut** w czasie rzeczywistym dzięki integracji z API NBP.

### 🚀 Kluczowe Funkcje
* **Wsparcie Wielu Walut**: Automatyczne pobieranie kursów (USD, EUR, PLN) z Narodowego Banku Polskiego.
* **Tryb Hybrydowy**: Działa dla **Zalogowanych Użytkowników** (Baza SQLite) oraz dla **Gości** (Local Storage).
* **Interaktywny Dashboard**: Wizualizacja trendów finansowych za pomocą wykresów liniowych i słupkowych (Chart.js).
* **Historia Transakcji**: Filtrowanie po kategoriach, datach oraz kwotach.
* **Inteligentne Przeliczenia**: Każda kwota jest przeliczana na wybraną walutę "w locie".

### 🛠 Technologie
* **Backend**: .NET 9 Web API, Entity Framework Core, SQLite.
* **Frontend**: React.js, SCSS, Chart.js.
* **API**: Integracja z API NBP (kursy średnie z tabeli A).

### 📦 Uruchomienie Lokalnie
1. **Backend**: 
   - Wejdź do folderu `backend`, wykonaj `dotnet restore` oraz `dotnet run`.
   - Serwer ruszy na `http://localhost:5109`.
2. **Frontend**:
   - Wejdź do folderu `frontend`, wykonaj `npm install` oraz `npm start`.
   - Aplikacja ruszy na `http://localhost:3000`.

---

## English Version (EN)

A modern full-stack application for managing personal finances with **real-time currency conversion** integrated with the NBP API.

### 🚀 Key Features
* **Multi-Currency Support**: Automatically fetch exchange rates (USD, EUR, PLN) from the National Bank of Poland.
* **Dual Mode**: Use the app as a **Logged-in User** (SQLite DB) or as a **Guest** (Local Storage).
* **Dynamic Dashboard**: Financial trends visualized with line and bar charts (Chart.js).
* **Smart History**: Full list of transactions with category, date, and amount filtering.
* **Automated Conversions**: Every amount is dynamically converted to your selected currency.

### 🛠 Tech Stack
* **Backend**: .NET 9 Web API, SQLite (EF Core), ASP.NET Core Identity.
* **Frontend**: React.js, SCSS, Chart.js, React Icons.
* **Services**: Background currency fetching service.

### 📦 Installation
1. **Backend**:
   - Navigate to `backend`, run `dotnet restore` and `dotnet run`.
2. **Frontend**:
   - Navigate to `frontend`, run `npm install` and `npm start`.

---

## 👨‍💻 Author
**Skute** - *Finance Tracker Main Project*









https://dominik9123.github.io/financev2/
