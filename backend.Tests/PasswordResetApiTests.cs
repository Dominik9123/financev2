using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using backend.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Backend.Tests;

public sealed class PasswordResetApiFixture : ValidationApiFixture
{
    public const string ResetUrl = "http://localhost:3001/financev2/";
    public CapturingEmailSender Emails { get; } = new();
    public DataProtectionTokenProviderOptions TokenOptions { get; private set; } = null!;

    protected override void ConfigureTestServices(WebApplicationBuilder builder)
    {
        builder.Configuration["Frontend:PasswordResetUrl"] = ResetUrl;
        builder.Services.RemoveAll<IEmailSender>();
        builder.Services.AddSingleton<IEmailSender>(Emails);
        builder.Services.Configure<DataProtectionTokenProviderOptions>(options => TokenOptions = options);
    }
}

public sealed class CapturingEmailSender : IEmailSender
{
    public ConcurrentQueue<(string Email, string Html)> Messages { get; } = new();

    public Task SendEmailAsync(string email, string subject, string message)
    {
        Messages.Enqueue((email, message));
        return Task.CompletedTask;
    }
}

public class PasswordResetApiTests(PasswordResetApiFixture fixture) : IClassFixture<PasswordResetApiFixture>
{
    private const string NewPassword = "NewTestPass2!";
    private const string OtherPassword = "OtherTestPass3!";
    private const string InvalidLinkMessage = "This reset link is invalid, expired or has already been used. Request a new link.";

    private async Task<string> CreateAccountAsync()
    {
        var email = $"reset-{Guid.NewGuid():N}+tag@example.test";
        using var client = fixture.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            firstName = "Reset", lastName = "Test", email, password = ValidationApiFixture.Password
        });
        response.EnsureSuccessStatusCode();
        return email;
    }

    private async Task<string> RequestTokenAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        response.EnsureSuccessStatusCode();
        var mail = fixture.Emails.Messages.Last(message => message.Email == email);
        var match = Regex.Match(mail.Html, "href='([^']+)'");
        Assert.True(match.Success, "Expected a password reset link in the captured email.");
        Assert.Contains("&amp;", match.Groups[1].Value);
        var link = WebUtility.HtmlDecode(match.Groups[1].Value);
        Assert.StartsWith(PasswordResetApiFixture.ResetUrl + "?", link);
        var query = QueryHelpers.ParseQuery(new Uri(link).Query);
        Assert.Equal(email, query["email"].ToString());
        Assert.False(string.IsNullOrWhiteSpace(query["token"]));
        return query["token"].ToString();
    }

    private static Task<HttpResponseMessage> ResetAsync(HttpClient client, string email, string token, string password = NewPassword) =>
        client.PostAsJsonAsync("/api/auth/reset-password", new { email, token, newPassword = password });

    private static async Task AssertInvalidLinkAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal(InvalidLinkMessage, problem["errors"]!["Token"]![0]!.GetValue<string>());
    }

    [Fact]
    public async Task ExistingAndMissingAccountsReceiveTheSameResponseButOnlyTheExistingAccountGetsAnEmail()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var before = fixture.Emails.Messages.Count;
        var existing = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var missing = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = $"missing-{Guid.NewGuid():N}@example.test" });
        Assert.Equal(HttpStatusCode.OK, existing.StatusCode);
        Assert.Equal(HttpStatusCode.OK, missing.StatusCode);
        Assert.Equal(await existing.Content.ReadAsStringAsync(), await missing.Content.ReadAsStringAsync());
        Assert.Equal(before + 1, fixture.Emails.Messages.Count);
        Assert.Equal(email, fixture.Emails.Messages.Last().Email);
    }

    [Fact]
    public async Task AValidEmailLinkChangesThePasswordAndPreservesEncodedParameters()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var token = await RequestTokenAsync(client, email);
        (await ResetAsync(client, email, token)).EnsureSuccessStatusCode();
        var oldLogin = await client.PostAsJsonAsync("/api/auth/login", new { email, password = ValidationApiFixture.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
        var newLogin = await client.PostAsJsonAsync("/api/auth/login", new { email, password = NewPassword });
        newLogin.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task AUsedLinkCannotChangeThePasswordAgain()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var token = await RequestTokenAsync(client, email);
        (await ResetAsync(client, email, token)).EnsureSuccessStatusCode();
        await AssertInvalidLinkAsync(await ResetAsync(client, email, token, OtherPassword));
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = NewPassword });
        login.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ATokenCannotBeUsedForAnotherAccount()
    {
        var email = await CreateAccountAsync();
        var otherEmail = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var token = await RequestTokenAsync(client, email);
        await AssertInvalidLinkAsync(await ResetAsync(client, otherEmail, token));
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = otherEmail, password = ValidationApiFixture.Password });
        login.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ATamperedTokenIsRejected()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var token = await RequestTokenAsync(client, email);
        await AssertInvalidLinkAsync(await ResetAsync(client, email, token + "changed"));
    }

    [Fact]
    public async Task AnExpiredTokenIsRejectedWithoutWaitingOrChangingProductionSettings()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var token = await RequestTokenAsync(client, email);
        var original = fixture.TokenOptions.TokenLifespan;
        try
        {
            fixture.TokenOptions.TokenLifespan = TimeSpan.Zero;
            await AssertInvalidLinkAsync(await ResetAsync(client, email, token));
        }
        finally { fixture.TokenOptions.TokenLifespan = original; }
    }

    [Fact]
    public async Task AnInvalidPasswordDoesNotConsumeAValidToken()
    {
        var email = await CreateAccountAsync();
        using var client = fixture.CreateClient();
        var token = await RequestTokenAsync(client, email);
        var weak = await ResetAsync(client, email, token, "1234");
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        var problem = (await weak.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.NotNull(problem["errors"]!["NewPassword"]);
        (await ResetAsync(client, email, token)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task AResetForAMissingAccountUsesTheSameInvalidLinkError()
    {
        using var client = fixture.CreateClient();
        await AssertInvalidLinkAsync(await ResetAsync(client, "missing@example.test", "invalid-token"));
    }
}
