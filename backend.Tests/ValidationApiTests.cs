using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests;

public class ValidationApiTests(ValidationApiFixture fixture) : IClassFixture<ValidationApiFixture>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static JsonObject TransactionBody() =>
        JsonSerializer.SerializeToNode(ValidationTests.ValidTransaction(), JsonOptions)!.AsObject();

    private static StringContent JsonContent(JsonNode body) => new(body.ToJsonString(), Encoding.UTF8, "application/json");

    public static IEnumerable<object[]> InvalidTransactionRequests()
    {
        var cases = new[]
        {
            ("amount", "-10", "Amount"), ("amount", "0", "Amount"),
            ("amount", "10.123", "Amount"), ("amount", "1000000000.01", "Amount"),
            ("title", "\"   \"", "Title"), ("category", "\"\"", "Category"),
            ("currency", "\"BTC\"", "Currency"), ("type", "\"Other\"", "Type"),
            ("date", "null", "Date"), ("date", "\"0001-01-01T00:00:00\"", "Date")
        };
        foreach (var method in new[] { "POST", "PUT" })
            foreach (var (field, json, errorField) in cases)
                yield return new object[] { method, field, json, errorField };
    }

    [Theory]
    [MemberData(nameof(InvalidTransactionRequests))]
    public async Task InvalidTransactionsReturn400WithoutChangingTheDatabase(string method, string field, string json, string errorField)
    {
        using var client = await fixture.SignedInClientAsync();
        var created = await client.PostAsync("/api/transaction", JsonContent(TransactionBody()));
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<JsonObject>())!["id"]!.GetValue<int>();
        var beforeCount = await fixture.WithDatabaseAsync(db => db.Transactions.CountAsync());
        var body = TransactionBody();
        body[field] = JsonNode.Parse(json);
        var path = method == "POST" ? "/api/transaction" : $"/api/transaction/{id}";
        using var request = new HttpRequestMessage(new HttpMethod(method), path) { Content = JsonContent(body) };
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(problem!["errors"]![errorField]);
        Assert.Equal(beforeCount, await fixture.WithDatabaseAsync(db => db.Transactions.CountAsync()));
        var transaction = await fixture.WithDatabaseAsync(db => db.Transactions.SingleAsync(t => t.Id == id));
        Assert.Equal(12.34m, transaction.Amount);
        Assert.Equal("Salary", transaction.Title);
        Assert.Equal("Income", transaction.Category);
        Assert.Equal("Income", transaction.Type);
        Assert.Equal("PLN", transaction.Currency);
        Assert.Equal(ValidationTests.ValidTransaction().Date, transaction.Date);
    }

    [Fact]
    public async Task MissingAndMalformedDatesReturn400()
    {
        using var client = await fixture.SignedInClientAsync();
        var body = TransactionBody();
        body.Remove("date");
        var missing = await client.PostAsync("/api/transaction", JsonContent(body));
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        body["date"] = "not-a-date";
        var malformed = await client.PostAsync("/api/transaction", JsonContent(body));
        Assert.Equal(HttpStatusCode.BadRequest, malformed.StatusCode);
    }

    [Fact]
    public async Task ValidTransactionFieldsAreTrimmedOnCreateAndUpdate()
    {
        using var client = await fixture.SignedInClientAsync();
        var body = TransactionBody();
        body["title"] = "  Salary  ";
        body["category"] = "  Income  ";
        var created = await client.PostAsync("/api/transaction", JsonContent(body));
        created.EnsureSuccessStatusCode();
        var transaction = (await created.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal("Salary", transaction["title"]!.GetValue<string>());
        Assert.Equal("Income", transaction["category"]!.GetValue<string>());
        body["title"] = "  Updated  ";
        body["amount"] = 20.12m;
        var updated = await client.PutAsync($"/api/transaction/{transaction["id"]}", JsonContent(body));
        updated.EnsureSuccessStatusCode();
        Assert.Equal("Updated", (await updated.Content.ReadFromJsonAsync<JsonObject>())!["title"]!.GetValue<string>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    [InlineData("12345678901234567890123456")]
    public async Task InvalidCategoriesReturn400WithoutSaving(string? name)
    {
        using var client = await fixture.SignedInClientAsync();
        var beforeCount = await fixture.WithDatabaseAsync(db => db.Categories.CountAsync());
        var response = await client.PostAsJsonAsync("/api/category", new { name });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(beforeCount, await fixture.WithDatabaseAsync(db => db.Categories.CountAsync()));
    }

    [Fact]
    public async Task CategoryNamesAreTrimmedAndDuplicatesAreCaseInsensitive()
    {
        using var client = await fixture.SignedInClientAsync();
        var name = "Żywność-" + Guid.NewGuid().ToString("N")[..6];
        var first = await client.PostAsJsonAsync("/api/category", new { name = $"  {name}  " });
        first.EnsureSuccessStatusCode();
        Assert.Equal(name, (await first.Content.ReadFromJsonAsync<JsonObject>())!["name"]!.GetValue<string>());
        var duplicate = await client.PostAsJsonAsync("/api/category", new { name = name.ToUpperInvariant() });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal(1, await fixture.WithDatabaseAsync(db => db.Categories.CountAsync(c => c.Name == name)));
    }

    [Fact]
    public async Task CanonicallyEquivalentUnicodeNamesCannotBeDuplicated()
    {
        using var client = await fixture.SignedInClientAsync();
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var first = await client.PostAsJsonAsync("/api/category", new { name = "Caf\u00e9" + suffix });
        first.EnsureSuccessStatusCode();
        var second = await client.PostAsJsonAsync("/api/category", new { name = "Cafe\u0301" + suffix });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task ConcurrentCategoryRequestsCannotCreateDuplicates()
    {
        using var firstClient = await fixture.SignedInClientAsync();
        using var secondClient = await fixture.SignedInClientAsync();
        var name = "Concurrent-" + Guid.NewGuid().ToString("N")[..8];
        var responses = await Task.WhenAll(
            firstClient.PostAsJsonAsync("/api/category", new { name }),
            secondClient.PostAsJsonAsync("/api/category", new { name = name.ToUpperInvariant() }));
        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.OK));
        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task CategoryUniquenessIsScopedToTheAccount()
    {
        using var clientA = await fixture.SignedInClientAsync();
        using var clientB = await fixture.SignedInClientAsync(ValidationApiFixture.UserB);
        var name = "Shared-" + Guid.NewGuid().ToString("N")[..8];
        var resultA = await clientA.PostAsJsonAsync("/api/category", new { name });
        var resultB = await clientB.PostAsJsonAsync("/api/category", new { name });
        resultA.EnsureSuccessStatusCode();
        resultB.EnsureSuccessStatusCode();
        var categoryA = (await resultA.Content.ReadFromJsonAsync<JsonObject>())!;
        var categoryB = (await resultB.Content.ReadFromJsonAsync<JsonObject>())!;
        var categoriesA = (await clientA.GetFromJsonAsync<JsonArray>("/api/category"))!;
        Assert.Contains(categoriesA, category => category!["id"]!.GetValue<int>() == categoryA["id"]!.GetValue<int>());
        Assert.DoesNotContain(categoriesA, category => category!["id"]!.GetValue<int>() == categoryB["id"]!.GetValue<int>());
    }

    [Theory]
    [InlineData(" food ")]
    [InlineData("HOUSING")]
    [InlineData("Income")]
    [InlineData("All")]
    public async Task BuiltInCategoryNamesCannotBeAddedAgain(string name)
    {
        using var client = await fixture.SignedInClientAsync();
        var response = await client.PostAsJsonAsync("/api/category", new { name });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("firstName", "\"   \"")]
    [InlineData("lastName", "null")]
    [InlineData("email", "\"not-an-email\"")]
    [InlineData("password", "\"Ab1!\"")]
    [InlineData("password", "\"lowercase1!\"")]
    public async Task InvalidRegistrationReturns400WithoutCreatingAnAccount(string field, string json)
    {
        using var client = fixture.CreateClient();
        var beforeCount = await fixture.WithDatabaseAsync(db => db.Users.CountAsync());
        var body = RegistrationBody();
        body[field] = JsonNode.Parse(json);
        var response = await client.PostAsync("/api/auth/register", JsonContent(body));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(beforeCount, await fixture.WithDatabaseAsync(db => db.Users.CountAsync()));
    }

    [Fact]
    public async Task RegistrationTrimsNamesAndEmailAndRejectsDuplicateEmail()
    {
        using var client = fixture.CreateClient();
        var body = RegistrationBody();
        var email = "register-" + Guid.NewGuid().ToString("N") + "@example.test";
        body["email"] = $" {email} ";
        body["firstName"] = " Anna ";
        body["lastName"] = " O’Connor ";
        var response = await client.PostAsync("/api/auth/register", JsonContent(body));
        response.EnsureSuccessStatusCode();
        var user = await fixture.WithDatabaseAsync(db => db.Users.SingleAsync(u => u.Email == email));
        Assert.Equal("Anna", user.FirstName);
        Assert.Equal("O’Connor", user.LastName);
        body["email"] = email.ToUpperInvariant();
        var duplicate = await client.PostAsync("/api/auth/register", JsonContent(body));
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = ValidationApiFixture.Password });
        login.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task WeakResetPasswordIsRejectedBeforeTokenProcessing()
    {
        using var client = fixture.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/reset-password", new
        {
            email = ValidationApiFixture.UserA, token = "not-a-token", newPassword = "1234"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.NotNull(problem["errors"]!["NewPassword"]);
    }

    private static JsonObject RegistrationBody() => new()
    {
        ["firstName"] = "Anna", ["lastName"] = "Kowalska",
        ["email"] = "new-user@example.test", ["password"] = ValidationApiFixture.Password,
    };
}
