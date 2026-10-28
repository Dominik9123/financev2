using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Backend.Tests;

public sealed class ExportAndRatesApiFixture : ValidationApiFixture
{
    internal StubNbpHandler Nbp { get; } = new();
    internal ManualRateClock Clock { get; } = new();

    protected override void ConfigureTestServices(WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient("nbp").ConfigurePrimaryHttpMessageHandler(() => Nbp);
        builder.Services.RemoveAll<CurrencyService>();
        builder.Services.AddSingleton(provider => new CurrencyService(
            provider.GetRequiredService<IHttpClientFactory>(),
            provider.GetRequiredService<ILogger<CurrencyService>>(), Clock));
    }

    internal void SetRates(decimal usd = 4m)
    {
        Clock.Advance(TimeSpan.FromHours(2));
        Nbp.Respond = () => Task.FromResult(StubNbpHandler.JsonResponse(StubNbpHandler.Table(usd)));
    }
}

public class ExportAndRatesApiTests(ExportAndRatesApiFixture fixture) : IClassFixture<ExportAndRatesApiFixture>
{
    private async Task<HttpClient> AccountClientAsync()
    {
        var email = $"export-{Guid.NewGuid():N}@example.test";
        var client = fixture.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/register", new
        {
            firstName = "Export", lastName = "Test", email, password = ValidationApiFixture.Password
        })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/auth/login", new { email, password = ValidationApiFixture.Password })).EnsureSuccessStatusCode();
        return client;
    }

    private static async Task<int> AddAsync(HttpClient client, decimal amount, string currency, string type = "Income", string title = "Transaction", string category = "Income")
    {
        var response = await client.PostAsJsonAsync("/api/transaction", new
        {
            title, amount, currency, category, type, date = "2026-10-28T12:00:00Z"
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<int>();
    }

    [Fact]
    public async Task CsvContainsOnlyTheCurrentAccountsOriginalAmountsAndCurrencies()
    {
        using var accountA = await AccountClientAsync();
        using var accountB = await AccountClientAsync();
        await AddAsync(accountA, 12.50m, "USD", title: "Żywność; \"lunch\"", category: "=1+1");
        await AddAsync(accountB, 500m, "EUR", title: "Other account secret");
        var response = await accountA.GetAsync("/api/transaction/export");
        response.EnsureSuccessStatusCode();
        Assert.Equal("text/csv", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType.CharSet);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition!.DispositionType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        var rows = TransactionCsvExporterTests.ReadRows(bytes);
        Assert.Equal(2, rows.Count);
        Assert.Equal("Żywność; \"lunch\"", rows[1][1]);
        Assert.Equal(12.5m, decimal.Parse(rows[1][2], System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal("USD", rows[1][3]);
        Assert.Equal("'=1+1", rows[1][4]);
        Assert.DoesNotContain("Other account secret", System.Text.Encoding.UTF8.GetString(bytes));
    }

    [Fact]
    public async Task SummaryConvertsEachOriginalCurrencyAndIsScopedToTheAccount()
    {
        fixture.SetRates();
        using var accountA = await AccountClientAsync();
        using var accountB = await AccountClientAsync();
        await AddAsync(accountA, 100m, "PLN");
        await AddAsync(accountA, 100m, "USD");
        await AddAsync(accountA, 10m, "EUR", "Expense", category: "Food");
        await AddAsync(accountB, 9000m, "USD");
        var result = (await accountA.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(500m, result["totalIncome"]!.GetValue<decimal>());
        Assert.Equal(50m, result["totalExpense"]!.GetValue<decimal>());
        Assert.Equal(450m, result["balance"]!.GetValue<decimal>());
        Assert.Equal("PLN", result["currency"]!.GetValue<string>());
    }

    [Fact]
    public async Task SummaryRoundsAfterSummingInsteadOfRoundingEveryTransaction()
    {
        fixture.SetRates(1.5m);
        using var client = await AccountClientAsync();
        await AddAsync(client, 0.01m, "USD");
        await AddAsync(client, 0.01m, "USD");
        var result = (await client.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(0.03m, result["totalIncome"]!.GetValue<decimal>());
        Assert.Equal(0.03m, result["balance"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task EmptyAndSameCurrencySummariesDoNotCallNbp()
    {
        fixture.SetRates();
        var beforeCalls = fixture.Nbp.Calls;
        using var client = await AccountClientAsync();
        var empty = (await client.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(0m, empty["balance"]!.GetValue<decimal>());
        await AddAsync(client, 100m, "PLN");
        var result = (await client.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(100m, result["balance"]!.GetValue<decimal>());
        Assert.Equal(beforeCalls, fixture.Nbp.Calls);
    }

    [Fact]
    public async Task UnsupportedSummaryCurrencyReturns400BeforeAnyNbpRequest()
    {
        using var client = await AccountClientAsync();
        var beforeCalls = fixture.Nbp.Calls;
        var response = await client.GetAsync("/api/transaction/summary?targetCurrency=BTC");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(beforeCalls, fixture.Nbp.Calls);
    }

    [Fact]
    public async Task NbpFailureReturns503AndTheNextRequestCanRecover()
    {
        fixture.SetRates();
        using var client = await AccountClientAsync();
        await AddAsync(client, 100m, "USD");
        fixture.Nbp.Respond = () => Task.FromException<HttpResponseMessage>(new HttpRequestException("Test outage"));
        var failed = await client.GetAsync("/api/transaction/summary?targetCurrency=PLN");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        var problem = (await failed.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal("Exchange rates are unavailable.", problem["title"]!.GetValue<string>());
        fixture.Nbp.Respond = () => Task.FromResult(StubNbpHandler.JsonResponse(StubNbpHandler.Table()));
        var recovered = (await client.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(400m, recovered["totalIncome"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task SummaryRefreshesRatesAfterTheCacheExpires()
    {
        fixture.SetRates();
        using var client = await AccountClientAsync();
        await AddAsync(client, 100m, "USD");
        var first = (await client.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(400m, first["totalIncome"]!.GetValue<decimal>());
        fixture.SetRates(5m);
        var refreshed = (await client.GetFromJsonAsync<JsonObject>("/api/transaction/summary?targetCurrency=PLN"))!;
        Assert.Equal(500m, refreshed["totalIncome"]!.GetValue<decimal>());
    }

    [Theory]
    [InlineData("export")]
    [InlineData("summary")]
    public async Task FinanceReportsRequireAuthentication(string endpoint)
    {
        using var client = fixture.CreateClient();
        var response = await client.GetAsync($"/api/transaction/{endpoint}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OutOfRangeCalculationsReturnAControlledErrorInsteadOf500()
    {
        fixture.SetRates(decimal.MaxValue);
        using var client = await AccountClientAsync();
        await AddAsync(client, 1000000000m, "USD");
        var response = await client.GetAsync("/api/transaction/summary?targetCurrency=PLN");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task IgnoredHistoricalTransactionTypesDoNotTriggerUnnecessaryConversions()
    {
        fixture.SetRates();
        using var client = await AccountClientAsync();
        var user = (await client.GetFromJsonAsync<JsonObject>("/api/auth/me"))!;
        var userId = user["id"]!.GetValue<string>();
        await fixture.WithDatabaseAsync(async db =>
        {
            db.Transactions.Add(new Transaction
            {
                UserId = userId, Title = "Historical entry", Amount = 100m,
                Currency = "USD", Category = "Other", Type = "Other", Date = DateTime.UtcNow
            });
            return await db.SaveChangesAsync();
        });
        var beforeCalls = fixture.Nbp.Calls;
        fixture.Nbp.Respond = () => Task.FromException<HttpResponseMessage>(new HttpRequestException("Test outage"));
        var response = await client.GetAsync("/api/transaction/summary?targetCurrency=PLN");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(beforeCalls, fixture.Nbp.Calls);
    }
}
