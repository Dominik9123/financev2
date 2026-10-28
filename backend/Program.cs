using backend.Data;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using backend.Validation;

var builder = WebApplication.CreateBuilder(args);

// 1. Konfiguracja bazy danych SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=financev2.db"));

builder.Services.AddIdentity<User, IdentityRole>(PasswordPolicy.ConfigureIdentity)
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders(); // Niezbędne do generowania tokenów resetu hasła

// 3. Rejestracja kontrolerów i usług
builder.Services.AddControllers();

// Rejestracja usługi wysyłania maili (Mailtrap)
builder.Services.AddOptions<SmtpOptions>()
    .Bind(builder.Configuration.GetSection(SmtpOptions.SectionName))
    .ValidateDataAnnotations();
builder.Services.AddTransient<IEmailSender, EmailSender>();

// Rejestracja HttpClient i CurrencyService
builder.Services.AddHttpClient("nbp", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddSingleton<CurrencyService>();

// 4. Konfiguracja CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
        policy.WithOrigins("http://localhost:3000", "http://localhost:3001")
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
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

var app = builder.Build();

// 6. Middleware Pipeline
app.UseCors("AllowReact");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

Console.WriteLine("Serwer uruchomiony na http://localhost:5109");
app.Run();
