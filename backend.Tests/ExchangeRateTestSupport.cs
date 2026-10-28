using System.Net;
using System.Text;
using System.Text.Json;

namespace Backend.Tests;

internal sealed class ManualRateClock : TimeProvider
{
    private DateTimeOffset _now = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => _now;
    public void Advance(TimeSpan time) => _now += time;
}

internal sealed class StubNbpHandler : HttpMessageHandler
{
    public int Calls;
    public Func<Task<HttpResponseMessage>> Respond { get; set; } =
        () => Task.FromResult(JsonResponse(Table()));

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref Calls);
        if (request.RequestUri?.Host != "api.nbp.pl")
            throw new InvalidOperationException("Unexpected test HTTP destination.");
        return Respond();
    }

    public static HttpResponseMessage JsonResponse(string json, HttpStatusCode status = HttpStatusCode.OK) => new(status)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    public static string Table(decimal usd = 4m) => JsonSerializer.Serialize(new[]
    {
        new { rates = new[]
        {
            new { code = "USD", mid = usd },
            new { code = "EUR", mid = 5m },
            new { code = "GBP", mid = 6m },
            new { code = "JPY", mid = 0.03m },
        } }
    });
}

internal sealed class StubNbpFactory(StubNbpHandler handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name)
    {
        if (name != "nbp") throw new InvalidOperationException("Unexpected test client name.");
        return new HttpClient(handler, disposeHandler: false);
    }
}
