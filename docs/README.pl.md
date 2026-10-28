# Finance Tracker — dokumentacja po polsku

[English README](../README.md) · [Demo online](https://dominik9123.github.io/financev2/)

Projekt full-stack do zarządzania finansami osobistymi: React, ASP.NET Core 9 i SQLite. Umożliwia zapisywanie przychodów i wydatków, analizę wykresów, filtrowanie historii i wyświetlanie kwot w PLN, USD, EUR, GBP oraz JPY.

## Demo a pełna aplikacja

**GitHub Pages udostępnia tryb gościa.** Dane i własne kategorie są zapisywane w local storage bieżącej przeglądarki. Demo pozwala sprawdzić Dashboard, historię, filtry i wybór waluty bez zakładania konta.

Pełna wersja lokalna udostępnia także rejestrację, logowanie przez ciasteczko Identity, reset hasła, dane użytkownika w SQLite i eksport CSV. Wymaga jednoczesnego uruchomienia frontendu i backendu. Dane gościa pozostają osobne i nie są importowane na konto po zalogowaniu.

## Technologie

| Część | Technologie |
| --- | --- |
| Frontend | React 19, React Router, Create React App, Chart.js, SCSS, React Toastify |
| Backend | ASP.NET Core 9, Identity, Entity Framework Core 9 |
| Dane | SQLite dla kont; local storage dla gości |
| Integracje | Kursy średnie tabeli A NBP; MailKit i SMTP do resetu hasła |
| Testy | Jest, React Testing Library, xUnit, testy HTTP z tymczasową bazą SQLite |

## Uruchomienie lokalne

Wymagania: Node.js 22.x z npm, .NET SDK 9 oraz Git. Backend jest kompilowany dla `net9.0`.

```powershell
git clone https://github.com/Dominik9123/financev2.git
cd financev2
```

### 1. Backend

W terminalu otwartym w katalogu głównym repozytorium:

```powershell
cd backend
dotnet restore
dotnet tool restore
dotnet ef database update
dotnet run --launch-profile http
```

`dotnet tool restore` przywraca narzędzie `dotnet-ef` z lokalnego manifestu. Migracje tworzą bazę `backend/financev2.db`. Repozytorium nie zawiera bazy ani gotowych kont; własne konto utwórz w aplikacji przez **Login → Register**.

API działa pod **http://localhost:5109/api** w środowisku `Development`. Pozostaw terminal uruchomiony. Brak SMTP nie blokuje startu aplikacji, rejestracji ani logowania; konfiguracja poczty jest potrzebna do wysłania wiadomości resetującej hasło.

### 2. Frontend

Otwórz drugi terminal w katalogu głównym repozytorium, przy pliku `package.json`:

```powershell
npm ci
npm start
```

Otwórz [http://localhost:3000/financev2/](http://localhost:3000/financev2/). Jeżeli port 3000 jest zajęty, zaakceptuj port 3001 i użyj [http://localhost:3001/financev2/](http://localhost:3001/financev2/). Backend dopuszcza oba adresy w lokalnym CORS. Przy testowaniu logowania używaj hosta `localhost` dla obu części aplikacji.

## Konfiguracja

| Ustawienie | Miejsce | Znaczenie |
| --- | --- | --- |
| `REACT_APP_API_URL` | `.env.local` w katalogu głównym | Adres API; domyślnie `http://localhost:5109/api` |
| `REACT_APP_GUEST_DEMO` | Środowisko budowania frontendu | `true` wyłącza funkcje konta i początkowe sprawdzanie sesji |
| `Frontend:PasswordResetUrl` | `backend/appsettings.Development.json` | Adres frontendu w linku resetującym; domyślnie port 3001 |
| `Smtp:*` | Konfiguracja backendu i User Secrets | Serwer poczty, nadawca i dane dostępowe |
| Ścieżka SQLite | `backend/Program.cs` | `Data Source=financev2.db`, względem katalogu roboczego backendu |

Opcjonalna konfiguracja adresu API, z katalogu głównego:

```powershell
Copy-Item .env.example .env.local
```

Zmień wartość w `.env.local` i uruchom ponownie frontend. Zmienne `REACT_APP_*` trafiają do kodu przeglądarki podczas budowania, dlatego służą do publicznej konfiguracji.

Dopasuj `Frontend:PasswordResetUrl` do działającego frontendu: `http://localhost:3000/financev2/` lub `http://localhost:3001/financev2/`. Po zmianie uruchom ponownie backend. Odpowiednikiem tego klucza w zmiennych środowiskowych jest `Frontend__PasswordResetUrl`.

### Poczta do resetowania hasła

Konfiguracja developerska używa **Mailtrap Email Sandbox** przez STARTTLS na porcie 587. Wiadomości trafiają do sandboxa, a nie do prawdziwej skrzynki odbiorcy.

Otwórz ustawienia integracji SMTP swojego sandboxa. W katalogu `backend/`, korzystając z **PowerShell 7**, wykonaj:

```powershell
$smtpUsername = Read-Host 'Mailtrap SMTP Username'
$smtpPassword = Read-Host 'Mailtrap SMTP Password' -MaskInput
@{ 'Smtp:Username' = $smtpUsername; 'Smtp:Password' = $smtpPassword } |
  ConvertTo-Json -Compress | dotnet user-secrets set
Remove-Variable smtpUsername, smtpPassword
```

Możesz też użyć **Manage User Secrets** w Visual Studio i ustawić `Smtp:Username` oraz `Smtp:Password`. Następnie uruchom ponownie backend. Host, port i nadawca znajdują się w `backend/appsettings.json`.

User Secrets przechowuje nieszyfrowane ustawienia developerskie poza repozytorium. Dane dostępowe nie powinny trafiać do śledzonych plików. Osobno hostowany backend może otrzymywać je przez magazyn sekretów hostingu lub zmienne `Smtp__Username` i `Smtp__Password`.

## Gdzie szukać kodu

| Katalog lub plik | Odpowiedzialność |
| --- | --- |
| `src/App.js` | Routing, bieżąca sesja i komunikaty o jej stanie |
| `src/pages/` | Dashboard, historia i ustawienia |
| `src/components/` | Nawigacja, formularze konta i podsumowania z wykresami |
| `src/hooks/useFinanceData.js` | Pobieranie danych konta lub odczyt danych gościa |
| `src/hooks/useSession.js` | Sprawdzanie sesji i blokowanie zapisu po jej wygaśnięciu |
| `src/hooks/useCurrencyRates.js` | Pobieranie kursów, stan ładowania, błąd i ponowienie |
| `src/services/` | Wspólne żądania API, odpowiedzi sesji i klient NBP |
| `src/utils/` | Walidacja i czyste funkcje przeliczania walut |
| `backend/Controllers/` | Endpointy konta, transakcji i kategorii |
| `backend/Models/` | Encje bazy danych |
| `backend/Models/DTOs/` | Dane wejściowe API i ich walidacja |
| `backend/Services/` | SMTP, kursy walut i generowanie CSV |
| `backend/Validation/` | Polityka haseł i reguły nazw kategorii |
| `backend/Data/`, `backend/Migrations/` | Kontekst EF Core i migracje schematu |
| `backend/Program.cs` | Rejestracja usług, ciasteczka, CORS i middleware |
| `backend.Tests/` | Testy jednostkowe i integracyjne backendu |

Przepływ danych konta: strona React → wspólny klient API → kontroler i walidacja DTO → EF Core → SQLite. Tryb gościa korzysta z osobnego odczytu i zapisu local storage. Schemat endpointów znajduje się w sekcji [API overview](../README.md#api-overview).

## Ważne zasady działania

- Transakcja zachowuje oryginalną kwotę i walutę. Zmiana waluty wyświetlania nie przepisuje danych w bazie.
- Przeliczenia korzystają z ostatniej opublikowanej tabeli średnich kursów NBP, a nie z notowań giełdowych w czasie rzeczywistym ani kursu z daty transakcji. Źródło: [dokumentacja NBP](https://api.nbp.pl/).
- Dashboard i Historia pobierają kursy przez wspólny hook i frontendowego klienta NBP. Osobny endpoint podsumowania API używa backendowego `CurrencyService` z godzinnym cache w pamięci. Interfejs nie korzysta obecnie z tego endpointu.
- Backend przelicza kwoty przed sumowaniem i zaokrągla sumy do dwóch miejsc po przecinku. Niedostępność kursów jest sygnalizowana błędem.
- CSV jest dostępny po zalogowaniu i zawiera wyłącznie transakcje tego konta w oryginalnych walutach. Używa separatora `;`, UTF-8 z BOM, cytowania pól tekstowych i prefiksu dla tekstu przypominającego formułę.
- Awaria żądania danych konta nie przełącza aplikacji po cichu na dane gościa. Wygaśnięcie sesji blokuje zapis i zachowuje formularz do ponownego logowania na to samo konto.
- Kwoty: `0.01`–`1000000000`, maksymalnie dwa miejsca po przecinku. Nowe hasła: 8–128 znaków, wielka litera, cyfra i znak specjalny. Pięć kolejnych błędnych haseł blokuje nowe logowania na pięć minut.
- API udostępnia edycję i usuwanie pojedynczych transakcji. Obecny interfejs obsługuje dodawanie, podgląd historii i reset wszystkich transakcji.

## Testy i build

Z katalogu głównego:

```powershell
npm test -- --watchAll=false --runInBand
dotnet test backend.Tests/backend.Tests.csproj -p:UseAppHost=false -p:BaseOutputPath=bin/validation-tests/
npm run build
```

Testy frontendu obejmują walidację, formularze, błędy API, zmianę stanu sesji i zachowanie niepotwierdzonych danych. Backend ma testy walidacji, izolacji kont, blokady logowania, tokenów resetu, CSV, cache i awarii NBP.

Testy backendu używają prawdziwych kontrolerów HTTP i Identity, ale osobnych tymczasowych baz SQLite oraz przechwyconych lub zastąpionych integracji. Nie modyfikują developerskiej bazy i nie wysyłają prawdziwych wiadomości. Osobny katalog wynikowy pozwala testować przy działającym lokalnym backendzie.

Audyt znanych podatności zależności:

```powershell
npm audit
dotnet list backend/backend.csproj package --vulnerable --include-transitive
```

Ręcznie sprawdź: dodanie i zachowanie transakcji gościa po odświeżeniu, zmianę waluty, filtry historii, rejestrację i ten sam przepływ po zalogowaniu, eksport CSV oraz oddzielenie danych drugiego konta. Po zatrzymaniu backendu zapis na koncie powinien pokazać błąd. Reset hasła sprawdź przez skonfigurowany sandbox SMTP.

## Budowanie i GitHub Pages

```powershell
npm run build       # Frontend pełnej aplikacji; wymaga osobnego API
npm run predeploy   # Build demo gościa bez publikacji
npm run deploy      # Ponowny build demo i publikacja na gh-pages
```

Skrypt `scripts/build-guest-demo.js` ustawia `REACT_APP_GUEST_DEMO=true`. Sam push kodu źródłowego nie uruchamia publikacji. Router i konfiguracja budowania używają obecnie ścieżki bazowej `/financev2/`.

Publiczne demo nie hostuje API ASP.NET Core. Funkcje konta są dostępne po uruchomieniu aplikacji lokalnie; obecna konfiguracja backendu jest przeznaczona do lokalnego developmentu.

Build demo tworzy także `history/index.html` i `settings/index.html` na podstawie gotowego pliku aplikacji. Dzięki temu GitHub Pages obsługuje bezpośrednie wejście i odświeżenie obu tras. Hosting może dodać końcowy ukośnik do adresu; React Router obsługuje obie wersje. Dodając nową stronę, dopisz jej trasę także w `scripts/build-guest-demo.js`. Wynika to ze [statycznego sposobu hostowania GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Typowe problemy

- **Brak `react-scripts`:** wykonaj `npm ci` w katalogu głównym, następnie `npm start`.
- **Brak połączenia z API:** sprawdź działanie backendu na porcie 5109 i wartość `REACT_APP_API_URL`; po zmianie `.env.local` zrestartuj frontend.
- **Brak tabel w bazie:** w `backend/` wykonaj `dotnet tool restore` i `dotnet ef database update`.
- **Link resetu otwiera zły port:** popraw `Frontend:PasswordResetUrl` i zrestartuj backend.
- **Brak wiadomości w zwykłej skrzynce:** wiadomości developerskie trafiają do sandboxa Mailtrap. Jeżeli nie ma ich także tam, sprawdź dane SMTP i log backendu.
