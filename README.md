# Finance Tracker

A full-stack personal finance project built with React, ASP.NET Core and SQLite. Track income and expenses, filter transaction history and view amounts in five currencies using NBP exchange rates.

[Live guest demo](https://dominik9123.github.io/financev2/) · [Dokumentacja po polsku](docs/README.pl.md)

## Demo and application modes

The GitHub Pages demo runs in **guest mode**. It stores transactions and custom categories in the current browser's local storage. You can try the dashboard, history filters and currency selection without an account.

The **full local application** adds registration, cookie-based login, password reset, account-specific SQLite data and CSV export. These features require the backend to run alongside the frontend. Guest data is separate from account data and is not imported when you sign in.

| Capability | Guest demo | Local account |
| --- | --- | --- |
| Add income and expenses | Yes | Yes |
| Dashboard charts and recent activity | Yes | Yes |
| History filters: category, date and amount | Yes | Yes |
| PLN, USD, EUR, GBP and JPY display currencies | Yes | Yes |
| Custom categories | Browser storage | SQLite, per account |
| Transaction storage | Current browser | SQLite, per account |
| CSV export | No | Yes |
| Registration, login and password reset | No | Yes; reset requires SMTP |

## Tech stack

- **Frontend:** React 19, React Router, Create React App, Chart.js, SCSS and React Toastify.
- **Backend:** ASP.NET Core 9 controllers, ASP.NET Core Identity and Entity Framework Core 9.
- **Storage:** SQLite for accounts; local storage for guests.
- **Integrations:** NBP table A exchange rates; MailKit for SMTP password-reset messages.
- **Tests:** Jest and React Testing Library; xUnit with real HTTP endpoints, Identity cookies and temporary SQLite databases.

## Run locally

Requirements: Node.js 22.x with npm, .NET 9 SDK and Git. The backend currently targets `net9.0`.

```powershell
git clone https://github.com/Dominik9123/financev2.git
cd financev2
```

### 1. Backend

From the repository root:

```powershell
cd backend
dotnet restore
dotnet tool restore
dotnet ef database update
dotnet run --launch-profile http
```

The local tool manifest installs the project's `dotnet-ef` version. Migrations create `backend/financev2.db`; no database or preconfigured user credentials are included in the repository.

The API starts at **http://localhost:5109/api** in the `Development` environment. Keep this terminal running. Registration and login work without SMTP; only sending password-reset emails requires mail credentials.

### 2. Frontend

Open a second terminal at the repository root, where `package.json` is located:

```powershell
npm ci
npm start
```

Open [http://localhost:3000/financev2/](http://localhost:3000/financev2/). If port 3000 is occupied, accept port 3001 and use [http://localhost:3001/financev2/](http://localhost:3001/financev2/). The backend allows both origins in its local CORS policy.

Register your own account through **Login → Register**, or continue as a guest. Use the same hostname, `localhost`, for both the frontend and backend when testing cookie-based login.

## Configuration

| Setting | Location | Purpose |
| --- | --- | --- |
| `REACT_APP_API_URL` | `.env.local` | API base URL; defaults to `http://localhost:5109/api` |
| `REACT_APP_GUEST_DEMO` | Frontend build environment | Set to `true` to disable account access and the initial session check |
| `Frontend:PasswordResetUrl` | `backend/appsettings.Development.json` | Frontend URL used in reset emails; defaults to port 3001 |
| `Smtp:*` | Backend configuration and User Secrets | SMTP connection, sender and credentials |
| SQLite path | `backend/Program.cs` | `Data Source=financev2.db`, relative to the backend's working directory |

To override the frontend API URL:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`, then restart `npm start`. Frontend environment variables are embedded during the build and are visible to browser users; use them for public configuration only.

Match `Frontend:PasswordResetUrl` to the running frontend port, including the `/financev2/` path. Restart the backend after changing it. The equivalent environment variable is `Frontend__PasswordResetUrl`.

### Password-reset email

The supplied development settings use **Mailtrap Email Sandbox** over STARTTLS on port 587. Messages appear in the sandbox rather than the recipient's real inbox.

In Mailtrap, open your sandbox's SMTP integration settings. From `backend/`, enter the credentials using **PowerShell 7**:

```powershell
$smtpUsername = Read-Host 'Mailtrap SMTP Username'
$smtpPassword = Read-Host 'Mailtrap SMTP Password' -MaskInput
@{ 'Smtp:Username' = $smtpUsername; 'Smtp:Password' = $smtpPassword } |
  ConvertTo-Json -Compress | dotnet user-secrets set
Remove-Variable smtpUsername, smtpPassword
```

Alternatively, use Visual Studio's **Manage User Secrets** and set `Smtp:Username` and `Smtp:Password`. Restart the backend after configuration. Host, port and sender defaults are in `backend/appsettings.json`.

User Secrets stores development settings outside the repository without encryption. Keep credentials out of tracked files. For a separately hosted backend, supply them through the host's secret store or `Smtp__Username` and `Smtp__Password` environment variables.

## Code map

```text
src/
  pages/              Dashboard, transaction history and settings
  components/         Navigation, authentication dialogs and chart summaries
  hooks/              Session guards, account/guest data and exchange-rate loading
  services/           HTTP requests, session responses and the NBP client
  utils/              Input validation and currency-conversion functions
backend/
  Controllers/        Authentication, transactions and categories
  Models/             Database entities
    DTOs/             API request shapes and input validation
  Services/           SMTP, exchange rates and CSV generation
  Validation/         Shared password policy and category-name rules
  Data/               EF Core database context
  Migrations/         Versioned SQLite schema changes
backend.Tests/        Backend unit and HTTP integration tests
scripts/              Guest-demo build script
docs/                 Polish documentation
```

Start with `src/App.js` for routes and session handling, then `src/pages/Dashboard.js` for the main user flow. `src/services/financeApi.js` centralizes API requests and errors. `useFinanceData` handles the account/guest split; `useSession` handles session checks and expired sessions.

On the backend, controllers receive validated DTOs and use EF Core for account-scoped data. `CurrencyService` and `TransactionCsvExporter` contain exchange-rate and CSV logic. Service registration, cookies and local CORS are in `backend/Program.cs`.

## Data and currency behavior

- Supported currencies: **PLN, USD, EUR, GBP and JPY**. Original amounts and currency codes are retained; changing the display currency does not rewrite stored transactions.
- The app requests the latest published **average rates from NBP table A**. These are not live market prices or historical transaction-date valuations. See the [NBP API documentation](https://api.nbp.pl/).
- Dashboard and History use the frontend NBP client through the shared `useCurrencyRates` hook. The separate API summary endpoint uses its own backend service, with a one-hour in-memory cache. The screens do not currently consume that endpoint.
- Backend summaries convert before summing and round totals to two decimal places. Missing or invalid exchange rates cause an error rather than a made-up conversion rate.
- CSV export contains the signed-in user's original amounts and currencies. It uses semicolon separators, UTF-8 with BOM, quoted text fields and a prefix for formula-like text.
- An account request failure never silently switches to guest data. Expired sessions block writes and preserve drafts for signing back into the same account.
- Transaction amounts must be between `0.01` and `1,000,000,000`, with at most two decimal places. New and reset passwords require 8–128 characters, an uppercase letter, a digit and a special character. Five consecutive wrong passwords temporarily block new sign-ins for five minutes.

## API overview

Paths below are relative to `/api`. Protected endpoints use the Identity authentication cookie, sent by the frontend with `credentials: "include"`.

| Method | Path | Purpose | Login required |
| --- | --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Account registration and session actions | No |
| GET | `/auth/me` | Current account profile | Yes |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Request or complete a password reset | No |
| GET / POST | `/transaction` | List or add account transactions | Yes |
| PUT / DELETE | `/transaction/{id}` | Update or delete an owned transaction | Yes |
| DELETE | `/transaction/reset` | Delete the account's transactions | Yes |
| GET | `/transaction/export` | Download CSV | Yes |
| GET | `/transaction/summary?targetCurrency=PLN` | Converted income, expenses and balance | Yes |
| GET / POST | `/category` | List or add custom categories | Yes |
| DELETE | `/category/{id}` | Delete an owned custom category | Yes |

The API exposes individual transaction update/delete operations; the current frontend focuses on adding transactions, viewing history and resetting all transactions.

## Verify changes

Run from the repository root:

```powershell
npm test -- --watchAll=false --runInBand
dotnet test backend.Tests/backend.Tests.csproj -p:UseAppHost=false -p:BaseOutputPath=bin/validation-tests/
npm run build
```

Frontend tests cover validation, account API failures, session transitions, dialogs and preserving unconfirmed input. Backend tests cover DTO validation, account isolation, lockouts, password-reset tokens, CSV output and exchange-rate failures/cache behavior. Backend tests use temporary databases and captured or stubbed integrations, without touching the development database or sending real emails.

The separate backend test output path avoids overwriting binaries used by a running development server. To review known dependency advisories:

```powershell
npm audit
dotnet list backend/backend.csproj package --vulnerable --include-transitive
```

For a manual check, add guest transactions, reload the page, change currency and filter history. Then register an account, repeat the flow, export CSV and confirm a second account sees separate data. Stop the API and check that account actions show an error rather than saving to guest storage. Test password reset through the configured SMTP sandbox.

## Build and GitHub Pages

```powershell
npm run build       # Full application frontend; requires a separately running API
npm run predeploy   # Build the guest-only demo without publishing
npm run deploy      # Rebuild the guest demo and publish it to gh-pages
```

`npm run deploy` sets `REACT_APP_GUEST_DEMO=true` through `scripts/build-guest-demo.js`. Pushing source commits alone does not run this deployment script. The router and build URL currently use the `/financev2/` base path.

The public demo does not host the ASP.NET Core API. Full account functionality is demonstrated locally; the backend configuration is currently intended for local development.

## Troubleshooting

- **`react-scripts` is not recognized:** run `npm ci` in the repository root, then `npm start`.
- **Cannot connect to the API:** confirm the backend is listening on port 5109, check `REACT_APP_API_URL` and restart the frontend after changing `.env.local`.
- **Missing database tables:** run `dotnet tool restore` and `dotnet ef database update` from `backend/`.
- **Reset link opens the wrong port:** update `Frontend:PasswordResetUrl` and restart the backend.
- **No reset email in your inbox:** development emails go to Mailtrap's sandbox. Check SMTP credentials and backend logs if no message arrives there.
