using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models;
using backend.Services;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionController : ControllerBase
{
    private readonly AppDbContext _context;

    private readonly CurrencyService _currencyService;

    public TransactionController(AppDbContext context, CurrencyService currencyService)
    {
        _context = context;
        _currencyService = currencyService;
    }

    [HttpGet]
    public async Task<IActionResult> GetTransactions()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var transactions = await _context.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.Date)
            .ToListAsync();
        return Ok(transactions);
    }


    [HttpGet("export")]
    public async Task<IActionResult> ExportToCsv()
    {
        //Pobieranie ID zalogowanego użytkownika z Claimow
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        //Pobieranie tylko transakcji należących do zalogowanego użytkownika
        var transactions = await _context.Transactions
        .Where(t => t.UserId == userId)
        .OrderByDescending(t => t.Date)
        .ToListAsync();

        //Budowanie zawartosci dla Pliku CSV
        var csvBuilder = new System.Text.StringBuilder();
        // Zmieniono na średniki, żeby nagłówek pasował do wierszy poniżej
        csvBuilder.AppendLine("Date;Title;Amount;Category;Type");

        foreach (var t in transactions)
        {
            //Formatowanie daty do czytelnego formatu oraz ze tekst nie ma srednikow
            var row = $"{t.Date:yyyy-MM-dd};{t.Title.Replace(";", " ")};{t.Amount};{t.Category};{t.Type}";
            csvBuilder.AppendLine(row);
        }

        // Kodowanie UTF-8 z BOM zeby polskie znaki dzialaly
        var encoding = System.Text.Encoding.UTF8;
        var preamble = encoding.GetPreamble();
        var content = encoding.GetBytes(csvBuilder.ToString());
        var fileContent = preamble.Concat(content).ToArray();

        //Zwracanie Pliku do Pobrania
        return File(fileContent, "text/csv", $"Eksport_{DateTime.Now:yyyyMMdd}.csv");
    }

    [HttpPost]
    public async Task<IActionResult> AddTransaction([FromBody] TransactionDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var transaction = new Transaction
        {
            UserId = userId,
            Title = dto.Title.Trim(),
            Amount = dto.Amount,
            Currency = dto.Currency,
            Category = dto.Category.Trim(),
            Type = dto.Type,
            Date = dto.Date!.Value
        };

        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync();
        return Ok(transaction);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTransaction(int id, [FromBody] TransactionDto updated)
    {
        var transaction = await _context.Transactions.FindAsync(id);
        if (transaction == null) return NotFound();

        if (transaction.UserId != User.FindFirstValue(ClaimTypes.NameIdentifier))
            return Unauthorized();

        transaction.Amount = updated.Amount;
        transaction.Currency = updated.Currency;
        transaction.Type = updated.Type;
        transaction.Title = updated.Title.Trim();
        transaction.Category = updated.Category.Trim();
        transaction.Date = updated.Date!.Value;

        await _context.SaveChangesAsync();
        return Ok(transaction);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTransaction(int id)
    {
        var transaction = await _context.Transactions.FindAsync(id);
        if (transaction == null) return NotFound();

        if (transaction.UserId != User.FindFirstValue(ClaimTypes.NameIdentifier))
            return Unauthorized();

        _context.Transactions.Remove(transaction);
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("reset")]
    public async Task<IActionResult> ResetMyData()
    {
        // Wyciąganie ID zalogowanego użytkownika
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Pobieranie wszystkich transakcji użytkownika
        var userTransactions = _context.Transactions.Where(t => t.UserId == userId);

        // Usuwanie wszystkich transakcji użytkownika
        _context.Transactions.RemoveRange(userTransactions);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Data reset successfully" });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] string targetCurrency = "USD")
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var transactions = await _context.Transactions
            .Where(t => t.UserId == userId)
            .ToListAsync();

        // Obliczanie sum przychodów i wydatków z konwersją walut
        decimal totalIncome = transactions
            .Where(t => t.Type == "Income")
            .Sum(t => _currencyService.Convert(t.Amount, t.Currency, targetCurrency));

        decimal totalExpense = transactions
            .Where(t => t.Type == "Expense")
            .Sum(t => _currencyService.Convert(t.Amount, t.Currency, targetCurrency));

        return Ok(new
        {
            TotalIncome = totalIncome,
            TotalExpense = totalExpense,
            Balance = totalIncome - totalExpense,
            Currency = targetCurrency
        });
    }
}

public class TransactionDto : IValidatableObject
{
    [Required(ErrorMessage = "Title is required.")]
    [StringLength(100, ErrorMessage = "Title cannot exceed 100 characters.")]
    public string Title { get; set; } = string.Empty;

    [Range(
        typeof(decimal),
        "0.01",
        "1000000000",
        ParseLimitsInInvariantCulture = true,
        ErrorMessage = "Amount must be between 0.01 and 1,000,000,000."
    )]
    public decimal Amount { get; set; }

    [Required(ErrorMessage = "Currency is required.")]
    [RegularExpression(
        "^(PLN|USD|EUR|GBP|JPY)$",
        ErrorMessage = "Currency must be PLN, USD, EUR, GBP or JPY."
    )]
    public string Currency { get; set; } = string.Empty;

    [Required(ErrorMessage = "Category is required.")]
    [StringLength(25, ErrorMessage = "Category cannot exceed 25 characters.")]
    public string Category { get; set; } = string.Empty;

    [Required(ErrorMessage = "Transaction type is required.")]
    [RegularExpression(
        "^(Income|Expense)$",
        ErrorMessage = "Transaction type must be Income or Expense."
    )]
    public string Type { get; set; } = string.Empty;

    [Required(ErrorMessage = "Date is required.")]
    public DateTime? Date { get; set; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (Amount != decimal.Round(Amount, 2))
        {
            yield return new ValidationResult(
                "Amount can have at most two decimal places.",
                new[] { nameof(Amount) }
            );
        }

        if (Date == DateTime.MinValue)
        {
            yield return new ValidationResult(
                "Date must be a valid transaction date.",
                new[] { nameof(Date) }
            );
        }
    }
}
