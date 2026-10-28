using System.Net;
using System.Net.Http.Json;
using backend.Data;
using backend.Models;
using backend.Services;
using backend.Validation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Backend.Tests;

// Real HTTP, Identity cookies and SQLite; no developer database, SMTP or NBP calls.
public class ValidationApiFixture : IAsyncLifetime
{
    public const string Password = "TestPass1!";
    public const string UserA = "user-a@example.test";
    public const string UserB = "user-b@example.test";
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "finance-validation-tests", Guid.NewGuid().ToString("N"));
    private WebApplication _app = null!;

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_directory);
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing",
            ApplicationName = typeof(TransactionController).Assembly.GetName().Name,
        });
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite($"Data Source={Path.Combine(_directory, "tests.db")}"));
        builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
        builder.Services.AddIdentity<User, IdentityRole>(PasswordPolicy.ConfigureIdentity)
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = ".FinanceValidationTests.Auth";
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = 401;
                return Task.CompletedTask;
            };
        });
        builder.Services.AddHttpClient();
        builder.Services.AddSingleton<CurrencyService>();
        builder.Services.AddSingleton<IEmailSender>(new NoEmailSender());
        builder.Services.AddControllers().AddApplicationPart(typeof(TransactionController).Assembly);
        ConfigureTestServices(builder);
        _app = builder.Build();
        _app.UseAuthentication();
        _app.UseAuthorization();
        _app.MapControllers();

        await using (var scope = _app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            foreach (var email in new[] { UserA, UserB })
            {
                var result = await manager.CreateAsync(new User
                {
                    UserName = email, Email = email, FirstName = "Test", LastName = "User"
                }, Password);
                if (!result.Succeeded) throw new InvalidOperationException("Could not create test account.");
            }
        }
        await _app.StartAsync();
    }

    protected virtual void ConfigureTestServices(WebApplicationBuilder builder) { }

    public HttpClient CreateClient() => new(new HttpClientHandler
    {
        AllowAutoRedirect = false,
        CookieContainer = new CookieContainer(),
    }) { BaseAddress = new Uri(_app.Urls.Single()) };

    public async Task<HttpClient> SignedInClientAsync(string email = UserA)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        return client;
    }

    public async Task<T> WithDatabaseAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public async Task<T> WithUserManagerAsync<T>(Func<UserManager<User>, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<UserManager<User>>());
    }

    public async Task DisposeAsync()
    {
        if (_app is not null) await _app.DisposeAsync();
        SqliteConnection.ClearAllPools();
        var expectedParent = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "finance-validation-tests")) + Path.DirectorySeparatorChar;
        var resolved = Path.GetFullPath(_directory);
        if (!resolved.StartsWith(expectedParent, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Refusing to remove an unexpected test directory.");
        if (Directory.Exists(resolved)) Directory.Delete(resolved, recursive: true);
    }

    private sealed class NoEmailSender : IEmailSender
    {
        public Task SendEmailAsync(string email, string subject, string message) =>
            throw new InvalidOperationException("Validation tests must not send email.");
    }
}
