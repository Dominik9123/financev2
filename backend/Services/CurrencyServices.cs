using System.Collections.ObjectModel;
using System.Text.Json;

namespace backend.Services;

public sealed class CurrencyService : IDisposable
{
    private static readonly HashSet<string> SupportedCurrencies =
        new(StringComparer.Ordinal)
        {
            "PLN", "USD", "EUR", "GBP", "JPY"
        };

    private readonly IHttpClientFactory _clients;
    private readonly ILogger<CurrencyService> _logger;
    private readonly TimeProvider _clock;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private IReadOnlyDictionary<string, decimal>? _rates;
    private DateTimeOffset _lastUpdate;

    public CurrencyService(
        IHttpClientFactory clients,
        ILogger<CurrencyService> logger,
        TimeProvider? clock = null)
    {
        _clients = clients;
        _logger = logger;
        _clock = clock ?? TimeProvider.System;
    }

    public static bool IsSupported(string? currency) =>
        currency is not null && SupportedCurrencies.Contains(currency);

    public async Task<IReadOnlyDictionary<string, decimal>> GetRatesAsync()
    {
        await _refreshLock.WaitAsync();

        try
        {
            if (_rates is not null &&
                _clock.GetUtcNow() - _lastUpdate < TimeSpan.FromHours(1))
            {
                return _rates;
            }

            using var client = _clients.CreateClient("nbp");

            var response = await client.GetStringAsync(
                "https://api.nbp.pl/api/exchangerates/tables/A/?format=json");

            using var document = JsonDocument.Parse(response);
            var root = document.RootElement;

            if (root.ValueKind != JsonValueKind.Array ||
                root.GetArrayLength() != 1)
            {
                throw new InvalidDataException("Invalid NBP table.");
            }

            var nextRates = new Dictionary<string, decimal>
            {
                ["PLN"] = 1m
            };

            foreach (var item in root[0].GetProperty("rates").EnumerateArray())
            {
                var code = item.GetProperty("code").GetString();

                if (!IsSupported(code) || code == "PLN")
                    continue;

                var mid = item.GetProperty("mid");

                if (mid.ValueKind != JsonValueKind.Number ||
                    !mid.TryGetDecimal(out var rate) ||
                    rate <= 0)
                {
                    throw new InvalidDataException(
                        $"Invalid exchange rate for {code}.");
                }

                if (!nextRates.TryAdd(code!, rate))
                {
                    throw new InvalidDataException(
                        $"Duplicate exchange rate for {code}.");
                }
            }

            if (nextRates.Count != SupportedCurrencies.Count)
            {
                throw new InvalidDataException(
                    "The NBP table is missing required currencies.");
            }

            _rates = new ReadOnlyDictionary<string, decimal>(nextRates);
            _lastUpdate = _clock.GetUtcNow();

            return _rates;
        }
        catch (Exception error) when (
            error is HttpRequestException or
            OperationCanceledException or
            JsonException or
            InvalidDataException or
            InvalidOperationException or
            KeyNotFoundException)
        {
            _logger.LogWarning(error, "Could not refresh NBP exchange rates.");

            throw new InvalidOperationException(
                "Exchange rates are currently unavailable.", error);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public static decimal Convert(
        decimal amount,
        string fromCurrency,
        string toCurrency,
        IReadOnlyDictionary<string, decimal> rates)
    {
        if (!IsSupported(fromCurrency) || !IsSupported(toCurrency))
        {
            throw new InvalidOperationException("Unsupported currency.");
        }

        if (fromCurrency == toCurrency)
            return amount;

        if (!rates.TryGetValue(fromCurrency, out var fromRate) ||
            !rates.TryGetValue(toCurrency, out var toRate) ||
            fromRate <= 0 ||
            toRate <= 0)
        {
            throw new InvalidOperationException(
                "A required exchange rate is missing.");
        }

        return amount * fromRate / toRate;
    }

    public void Dispose()
    {
        _refreshLock.Dispose();
    }
}