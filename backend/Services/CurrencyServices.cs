using System.Text.Json;

namespace backend.Services
{
    public class CurrencyService
    {
        private readonly HttpClient _httpClient;
        // Cache dla kursow, zeby nie pytac NBP co sekunde
        private Dictionary<string, decimal> _rates = new();
        private DateTime _lastUpdate;

        public CurrencyService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task UpdateRatesAsync()
        {
            try
            {
                //Pobieranie tabeli A z NBP
                var response = await _httpClient.GetStringAsync("https://api.nbp.pl/api/exchangerates/tables/A/?format=json");
                var data = JsonDocument.Parse(response);
                var ratesArray = data.RootElement[0].GetProperty("rates");

                var newRates = new Dictionary<string, decimal>();
                newRates["PLN"] = 1.0m; //Dodanie PLN jako bazowej waluty

                foreach (var rate in ratesArray.EnumerateArray())
                {
                    string code = rate.GetProperty("code").GetString() ?? "";
                    // Waluty
                    if (code == "USD" || code == "EUR" || code == "GBP" || code == "JPY")
                    {
                        newRates[code] = rate.GetProperty("mid").GetDecimal();
                    }
                }

                _rates = newRates;
                _lastUpdate = DateTime.Now;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Błąd pobierania kursów: {ex.Message}");
            }
        } // <-- Tutaj poprawiłem klamrę zamykającą UpdateRatesAsync

        public decimal Convert(decimal amount, string fromCurrency, string toCurrency)
        {
            if (!_rates.ContainsKey(fromCurrency) || !_rates.ContainsKey(toCurrency))
                return amount;  // Jesli brak kursu, zwroc oryginalna kwote

            //Przeliczanie na PLN, a potem na walute docelowa
            decimal inPln = amount * _rates[fromCurrency];
            return Math.Round(inPln / _rates[toCurrency], 2);
        }
    }
}