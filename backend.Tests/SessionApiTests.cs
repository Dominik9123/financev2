using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests;

public class SessionApiTests(ValidationApiFixture fixture) : IClassFixture<ValidationApiFixture>
{
    private async Task<string> CreateAccountAsync(string firstName = "Test")
    {
        var email = $"session-{Guid.NewGuid():N}@example.test";
        using var client = fixture.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            firstName, lastName = "User", email, password = ValidationApiFixture.Password
        });
        response.EnsureSuccessStatusCode();
        return email;
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string? password = null) =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password = password ?? ValidationApiFixture.Password });

    [Fact]
    public async Task AnAnonymousClientGets401ForTheSessionEndpoint()
    {
        using var client = fixture.CreateClient();
        var response = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task LoginAndSessionRestorationReturnTheSameStableIdentity()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var login = await LoginAsync(client, email);
        login.EnsureSuccessStatusCode();
        var signedIn = (await login.Content.ReadFromJsonAsync<JsonObject>())!;
        var restored = (await client.GetFromJsonAsync<JsonObject>("/api/auth/me"))!;
        Assert.False(string.IsNullOrWhiteSpace(signedIn["id"]!.GetValue<string>()));
        foreach (var field in new[] { "id", "email", "firstName", "lastName" })
            Assert.Equal(signedIn[field]!.GetValue<string>(), restored[field]!.GetValue<string>());
        Assert.Equal(email, restored["email"]!.GetValue<string>());
    }

    [Fact]
    public async Task AccountsWithTheSameFirstNameHaveDifferentIds()
    {
        var emailA = await CreateAccountAsync("Anna");
        var emailB = await CreateAccountAsync("Anna");
        using var clientA = fixture.CreateClient();
        using var clientB = fixture.CreateClient();
        var loginA = await LoginAsync(clientA, emailA);
        var loginB = await LoginAsync(clientB, emailB);
        loginA.EnsureSuccessStatusCode();
        loginB.EnsureSuccessStatusCode();
        var userA = (await clientA.GetFromJsonAsync<JsonObject>("/api/auth/me"))!;
        var userB = (await clientB.GetFromJsonAsync<JsonObject>("/api/auth/me"))!;
        Assert.Equal(userA["firstName"]!.GetValue<string>(), userB["firstName"]!.GetValue<string>());
        Assert.NotEqual(userA["id"]!.GetValue<string>(), userB["id"]!.GetValue<string>());
    }

    [Fact]
    public async Task FiveWrongPasswordsBlockNewLoginsUntilTheLockoutExpires()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var failure = await LoginAsync(client, email, "WrongPassword1!");
            Assert.Equal(HttpStatusCode.Unauthorized, failure.StatusCode);
        }
        var blocked = await LoginAsync(client, email);
        Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        var lockedUser = await fixture.WithDatabaseAsync(db => db.Users.SingleAsync(user => user.Email == email));
        Assert.True(lockedUser.LockoutEnabled);
        Assert.True(lockedUser.LockoutEnd > DateTimeOffset.UtcNow);
        Assert.True(lockedUser.LockoutEnd <= DateTimeOffset.UtcNow.AddMinutes(5));

        // Move only this test account's lockout into the past instead of sleeping.
        var result = await fixture.WithUserManagerAsync(async manager =>
        {
            var user = await manager.FindByEmailAsync(email);
            return await manager.SetLockoutEndDateAsync(user!, DateTimeOffset.UtcNow.AddMinutes(-1));
        });
        Assert.True(result.Succeeded);
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ASuccessfulLoginResetsTheFailedPasswordCounter()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        for (var attempt = 0; attempt < 4; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(client, email, "wrong")).StatusCode);
        var before = await fixture.WithDatabaseAsync(db => db.Users.SingleAsync(user => user.Email == email));
        Assert.Equal(4, before.AccessFailedCount);
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();
        var after = await fixture.WithDatabaseAsync(db => db.Users.SingleAsync(user => user.Email == email));
        Assert.Equal(0, after.AccessFailedCount);
    }

    [Fact]
    public async Task WrongPasswordUnknownAccountAndLockedAccountHaveTheSamePublicResponse()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var unknown = await LoginAsync(client, "unknown@example.test", "wrong");
        var expected = await unknown.Content.ReadAsStringAsync();
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var failure = await LoginAsync(client, email, "wrong");
            Assert.Equal(HttpStatusCode.Unauthorized, failure.StatusCode);
            Assert.Equal(expected, await failure.Content.ReadAsStringAsync());
        }
        var blocked = await LoginAsync(client, email);
        Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);
        Assert.Equal(expected, await blocked.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ConfirmedLogoutRemovesTheSession()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        (await LoginAsync(client, email)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        (await client.PostAsync("/api/auth/logout", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }
}
