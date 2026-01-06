using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Konfiguracja bazy danych SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=financev2.db"));

builder.Services.AddIdentity<User, IdentityRole>(options =>
{
    options.Password.RequiredLength = 4;
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders(); // Niezbędne do generowania tokenów resetu hasła

// 3. Rejestracja kontrolerów i usług
builder.Services.AddControllers();

// Rejestracja usługi wysyłania maili (Mailtrap)
builder.Services.AddTransient<IEmailSender, EmailSender>();

// Rejestracja HttpClient i CurrencyService
builder.Services.AddHttpClient();
builder.Services.AddSingleton<CurrencyService>();

// 4. Konfiguracja CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// 5. Konfiguracja ciasteczek (Authentication Cookie)
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = ".FinanceApp.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var currencyService = scope.ServiceProvider.GetRequiredService<CurrencyService>();
    await currencyService.UpdateRatesAsync();
}

// 6. Middleware Pipeline
app.UseCors("AllowReact");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

Console.WriteLine("Serwer uruchomiony na http://localhost:5109");
app.Run();