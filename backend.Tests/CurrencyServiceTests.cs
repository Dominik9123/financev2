using System.Net;
using backend.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Backend.Tests;

public class CurrencyServiceTests
{
    private static CurrencyService CreateService(StubNbpHandler handler, ManualRateClock? clock = null) =>
        new(new StubNbpFactory(handler), NullLogger<CurrencyService>.Instance, clock);

    [Fact]
    public async Task ConversionsUseTheOriginalCurrencyAndPreservePrecisionUntilSumming()
    {
        using var handler = new StubNbpHandler();
        using var service = CreateService(handler);
        var rates = await service.GetRatesAsync();
        Assert.Equal(400m, CurrencyService.Convert(100m, "USD", "PLN", rates));
        Assert.Equal(25m, CurrencyService.Convert(100m, "PLN", "USD", rates));
        Assert.Equal(125m, CurrencyService.Convert(100m, "EUR", "USD", rates));
        Assert.Equal(0.006m, CurrencyService.Convert(1m, "JPY", "EUR", rates));
        Assert.Equal(12.34m, CurrencyService.Convert(12.34m, "PLN", "PLN", new Dictionary<string, decimal>()));
    }

    [Fact]
    public async Task CacheExpiresAfterOneHourAndExistingSnapshotsDoNotChange()
    {
        using var handler = new StubNbpHandler();
        var clock = new ManualRateClock();
        using var service = CreateService(handler, clock);
        var first = await service.GetRatesAsync();
        clock.Advance(TimeSpan.FromMinutes(59));
        Assert.Same(first, await service.GetRatesAsync());
        Assert.Equal(1, handler.Calls);
        handler.Respond = () => Task.FromResult(StubNbpHandler.JsonResponse(StubNbpHandler.Table(5m)));
        clock.Advance(TimeSpan.FromMinutes(1));
        var refreshed = await service.GetRatesAsync();
        Assert.Equal(2, handler.Calls);
        Assert.Equal(4m, first["USD"]);
        Assert.Equal(5m, refreshed["USD"]);
        Assert.Throws<NotSupportedException>(() => ((IDictionary<string, decimal>)refreshed)["USD"] = 999m);
    }

    [Fact]
    public async Task ConcurrentRequestsShareOneRefresh()
    {
        using var handler = new StubNbpHandler();
        var finish = new TaskCompletionSource<HttpResponseMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        handler.Respond = () => finish.Task;
        using var service = CreateService(handler);
        var requests = Enumerable.Range(0, 12).Select(_ => service.GetRatesAsync()).ToArray();
        Assert.Equal(1, handler.Calls);
        finish.SetResult(StubNbpHandler.JsonResponse(StubNbpHandler.Table()));
        var snapshots = await Task.WhenAll(requests);
        Assert.All(snapshots, snapshot => Assert.Same(snapshots[0], snapshot));
        Assert.Equal(1, handler.Calls);
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("[")]
    [InlineData("[{}]")]
    [InlineData("[{\"rates\":{}}]")]
    [InlineData("[{\"rates\":[null]}]")]
    [InlineData("[{\"rates\":[{\"code\":\"USD\",\"mid\":0}]}]")]
    [InlineData("[{\"rates\":[{\"code\":\"USD\",\"mid\":-1}]}]")]
    [InlineData("[{\"rates\":[{\"code\":\"USD\",\"mid\":\"4\"}]}]")]
    [InlineData("[{\"rates\":[{\"code\":\"USD\",\"mid\":1e40}]}]")]
    [InlineData("[{\"rates\":[{\"code\":\"USD\",\"mid\":4},{\"code\":\"USD\",\"mid\":5}]}]")]
    [InlineData("[{\"rates\":[{\"code\":\"USD\",\"mid\":4},{\"code\":\"EUR\",\"mid\":5},{\"code\":\"GBP\",\"mid\":6}]}]")]
    public async Task MalformedOrIncompleteTablesAreRejected(string json)
    {
        using var handler = new StubNbpHandler { Respond = () => Task.FromResult(StubNbpHandler.JsonResponse(json)) };
        using var service = CreateService(handler);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetRatesAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task NetworkFailuresAndTimeoutsReleaseTheRefreshLock(bool timeout)
    {
        using var handler = new StubNbpHandler
        {
            Respond = () => timeout
                ? Task.FromException<HttpResponseMessage>(new TaskCanceledException("Test timeout"))
                : Task.FromException<HttpResponseMessage>(new HttpRequestException("Test network failure"))
        };
        using var service = CreateService(handler);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetRatesAsync());
        handler.Respond = () => Task.FromResult(StubNbpHandler.JsonResponse(StubNbpHandler.Table()));
        Assert.Equal(4m, (await service.GetRatesAsync())["USD"]);
    }

    [Fact]
    public async Task FailedRefreshDoesNotReturnExpiredOrPartiallyLoadedRates()
    {
        using var handler = new StubNbpHandler();
        var clock = new ManualRateClock();
        using var service = CreateService(handler, clock);
        var first = await service.GetRatesAsync();
        clock.Advance(TimeSpan.FromHours(2));
        handler.Respond = () => Task.FromResult(StubNbpHandler.JsonResponse("[]"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetRatesAsync());
        Assert.Equal(4m, first["USD"]);
        handler.Respond = () => Task.FromResult(StubNbpHandler.JsonResponse(StubNbpHandler.Table(5m)));
        Assert.Equal(5m, (await service.GetRatesAsync())["USD"]);
        Assert.Equal(3, handler.Calls);
    }

    [Fact]
    public async Task HttpErrorsAreNotCachedAsExchangeRates()
    {
        using var handler = new StubNbpHandler
        {
            Respond = () => Task.FromResult(StubNbpHandler.JsonResponse("{}", HttpStatusCode.ServiceUnavailable))
        };
        using var service = CreateService(handler);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetRatesAsync());
    }

    [Fact]
    public void MissingOrInvalidRatesNeverFallBackToTheOriginalAmount()
    {
        Assert.Throws<InvalidOperationException>(() => CurrencyService.Convert(100m, "USD", "PLN", new Dictionary<string, decimal>()));
        Assert.Throws<InvalidOperationException>(() => CurrencyService.Convert(100m, "USD", "PLN", new Dictionary<string, decimal> { ["USD"] = 0, ["PLN"] = 1 }));
        Assert.Throws<InvalidOperationException>(() => CurrencyService.Convert(100m, "BTC", "BTC", new Dictionary<string, decimal>()));
    }
}
