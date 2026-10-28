# 💰 Personal Finance Tracker v2.0

[English Version](#english-version-en) | [Wersja Polska](#wersja-polska-pl) | [🌐 Live Demo](https://dominik9123.github.io/financev2/)

---

## Wersja Polska (PL)

Aplikacja typu Full-Stack do zarządzania finansami osobistymi z **automatycznym przeliczaniem walut** w czasie rzeczywistym dzięki integracji z API NBP.

### 🌐 Demo Online
Przetestuj aplikację tutaj: [dominik9123.github.io/financev2/](https://dominik9123.github.io/financev2/)
> **Uwaga**: Wersja demonstracyjna GitHub Pages wspiera wyłącznie **Tryb Gościa** (dane zapisywane lokalnie w przeglądarce). Funkcje konta użytkownika i trwałej bazy danych wymagają uruchomienia backendu lokalnie.

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

**Wymagania:**

* Node.js 20 lub nowszy oraz npm.
* .NET SDK 9 — backend jest obecnie kompilowany dla `net9.0`.

**1. Backend**

Otwórz terminal w katalogu głównym projektu i wykonaj:

```powershell
cd backend
dotnet restore
dotnet tool restore
dotnet ef database update
dotnet run --launch-profile http
```

* `dotnet restore` pobiera zależności backendu z NuGet.
* `dotnet tool restore` przywraca lokalne narzędzie `dotnet-ef` z manifestu `backend/.config/dotnet-tools.json`.
* `dotnet ef database update` tworzy bazę SQLite przy pierwszym uruchomieniu lub aktualizuje jej schemat zgodnie z migracjami. Plik bazy powstaje w `backend/financev2.db`.
* `dotnet run --launch-profile http` uruchamia backend pod adresem [http://localhost:5109](http://localhost:5109), w środowisku `Development`.

Pozostaw ten terminal uruchomiony. Do testowania resetu hasła skonfiguruj SMTP zgodnie z sekcją „Konfiguracja poczty — lokalny development” poniżej.

**2. Frontend**

Otwórz **drugi terminal w katalogu głównym projektu**, w którym znajduje się `package.json`, i wykonaj:

```powershell
npm ci
npm start
```

`npm ci` instaluje zależności w wersjach zapisanych w `package-lock.json`, zapewniając powtarzalną instalację. Przy kolejnych uruchomieniach, jeśli zależności się nie zmieniły, wystarczy `npm start`.

Otwórz aplikację pod adresem [http://localhost:3000/financev2/](http://localhost:3000/financev2/).

Jeżeli port `3000` jest zajęty, serwer frontendu może zaproponować port `3001`. Wtedy otwórz [http://localhost:3001/financev2/](http://localhost:3001/financev2/). Backend dopuszcza oba lokalne adresy frontendu w konfiguracji CORS. Backend i frontend muszą działać jednocześnie, aby korzystać z kont użytkowników i danych zapisanych w SQLite.

### Testy i walidacja

Z katalogu głównego repozytorium:

```powershell
npm test -- --watchAll=false --runInBand
dotnet test backend.Tests/backend.Tests.csproj -p:UseAppHost=false -p:BaseOutputPath=bin/validation-tests/
```

Testy backendu uruchamiają rzeczywiste kontrolery HTTP, ASP.NET Core Identity i osobną, tymczasową bazę SQLite. Nie korzystają z `backend/financev2.db`, SMTP ani NBP. Osobny katalog wynikowy pozwala uruchamiać je przy działającym lokalnym backendzie.

Transakcje wymagają kwoty od `0.01` do `1000000000` z maksymalnie dwoma miejscami po przecinku, obsługiwanej waluty, typu `Income` lub `Expense`, tytułu (do 100 znaków), kategorii (do 25 znaków) i daty. Kategorie są przycinane i sprawdzane pod kątem duplikatów w obrębie konta, bez rozróżniania wielkości liter. Nazwy kategorii domyślnych oraz `Income` i `All` są zarezerwowane.

Rejestracja wymaga imienia i nazwiska (do 50 znaków każde), poprawnego adresu e-mail (do 254 znaków) oraz hasła długości 8–128 znaków z wielką literą, cyfrą i znakiem specjalnym. Te same wymagania hasła obowiązują przy resecie hasła.

### Konfiguracja poczty — lokalny development

Reset hasła używa Mailtrap Email Sandbox. Wiadomości trafiają do sandboxa w Mailtrap, nie do rzeczywistej skrzynki odbiorcy.

1. W Mailtrap otwórz **Email Testing → Sandboxes → swój sandbox → Integration**. Jeżeli dane SMTP były wcześniej opublikowane, wybierz **Reset Credentials** i użyj nowej pary danych dostępowych.
2. W PowerShell, w katalogu `backend`, zapisz nowe dane przez User Secrets. Poniższy kod poprosi o login i hasło bez umieszczania ich w historii poleceń:

   ```powershell
   $smtpUsername = Read-Host 'Mailtrap SMTP Username'
   $smtpPassword = Read-Host 'Mailtrap SMTP Password' -MaskInput
   @{ 'Smtp:Username' = $smtpUsername; 'Smtp:Password' = $smtpPassword } |
     ConvertTo-Json -Compress | dotnet user-secrets set
   Remove-Variable smtpUsername, smtpPassword
   ```

   Opcja `-MaskInput` wymaga PowerShell 7. W Windows PowerShell 5.1 można ustawić te wartości w Visual Studio: kliknij prawym przyciskiem projekt backendu, wybierz **Manage User Secrets** i dodaj klucze `Smtp:Username` oraz `Smtp:Password`.
3. Uruchom ponownie backend przez `dotnet run`. Profil lokalny ustawia środowisko `Development`, w którym ASP.NET Core automatycznie odczytuje User Secrets.

Host, port i nadawca znajdują się w `backend/appsettings.json`; można je nadpisać kluczami `Smtp:Host`, `Smtp:Port`, `Smtp:FromEmail` i `Smtp:FromName`. Integracja używa STARTTLS — wybierz obsługujący go port, np. 587.

User Secrets przechowuje dane poza repozytorium, w profilu użytkownika. Jest to mechanizm developerski; wartości nie są szyfrowane. Nie kopiuj ich do kodu ani plików konfiguracyjnych w repozytorium. Przy wdrożeniu użyj magazynu sekretów hostingu lub zmiennych środowiskowych `Smtp__Username` i `Smtp__Password`.

Brak danych SMTP nie blokuje startu aplikacji ani logowania. Konfiguracja jest walidowana dopiero przy próbie wysłania wiadomości resetującej hasło.

---

## English Version (EN)

A modern full-stack application for managing personal finances with **real-time currency conversion** integrated with the NBP API.

### 🌐 Live Demo
Check out the live version: [dominik9123.github.io/financev2/](https://dominik9123.github.io/financev2/)
> **Note**: The GitHub Pages demo supports **Guest Mode only** (LocalStorage). Features like user accounts and a persistent SQL database require running the backend locally.

### 🚀 Key Features
* **Multi-Currency Support**: Automatically fetch exchange rates (USD, EUR, PLN) from the National Bank of Poland.
* **Dual Mode**: Use the app as a **Logged-in User** (SQLite DB) or as a **Guest** (Local Storage).
* **Dynamic Dashboard**: Financial trends visualized with line and bar charts (Chart.js).
* **Smart History**: Full list of transactions with category, date, and amount filtering.
* **Automated Conversions**: Every amount is dynamically converted to your selected currency.

### 🛠 Tech Stack
* **Backend**: .NET 9 Web API, SQLite (EF Core), ASP.NET Core Identity.
* **Frontend**: React.js, SCSS, Chart.js, React Icons.

### 📦 Installation
1. **Backend**:
   - Navigate to `backend`, run `dotnet restore` and `dotnet run`.
2. **Frontend**:
   - Navigate to `frontend`, run `npm install` and `npm start`.

### Tests

Run from the repository root:

```powershell
npm test -- --watchAll=false --runInBand
dotnet test backend.Tests/backend.Tests.csproj -p:UseAppHost=false -p:BaseOutputPath=bin/validation-tests/
```

Backend tests use real HTTP controllers, Identity cookies and a temporary SQLite database. They do not access the development database, SMTP or NBP. New and reset passwords require 8–128 characters, an uppercase letter, a digit and a special character. Transaction amounts support up to two decimal places; custom category names are unique per account, ignoring case and surrounding whitespace.

### Email configuration — local development

Password reset uses Mailtrap Email Sandbox. Messages appear in the Mailtrap sandbox, not the recipient's real inbox.

1. Open **Email Testing → Sandboxes → your sandbox → Integration** in Mailtrap. If SMTP credentials were exposed, use **Reset Credentials** before configuring the app.
2. From `backend`, use PowerShell 7 to enter the new credentials without including their values in command history:

   ```powershell
   $smtpUsername = Read-Host 'Mailtrap SMTP Username'
   $smtpPassword = Read-Host 'Mailtrap SMTP Password' -MaskInput
   @{ 'Smtp:Username' = $smtpUsername; 'Smtp:Password' = $smtpPassword } |
     ConvertTo-Json -Compress | dotnet user-secrets set
   Remove-Variable smtpUsername, smtpPassword
   ```

   Alternatively, use Visual Studio's **Manage User Secrets** for the backend project and add `Smtp:Username` and `Smtp:Password`.
3. Restart the backend with `dotnet run`. The local launch profile uses `Development`, which loads User Secrets automatically.

Non-secret SMTP settings are in `backend/appsettings.json`. The integration requires a STARTTLS-capable port, such as 587. User Secrets stores unencrypted development credentials outside the repository. For deployment, use the hosting platform's secret store or environment variables `Smtp__Username` and `Smtp__Password`.

SMTP settings are validated when sending a password-reset email; missing credentials do not prevent startup or login.

---
