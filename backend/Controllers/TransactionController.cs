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
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var transactions = await _context.Transactions
            .Where(transaction => transaction.UserId == userId)
            .OrderByDescending(transaction => transaction.Date)
            .ToListAsync();

        return File(
            TransactionCsvExporter.Create(transactions),
            "text/csv; charset=utf-8",
            $"Eksport_{DateTime.UtcNow:yyyyMMdd}.csv");
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
    public async Task<IActionResult> GetSummary(
        [FromQuery] string targetCurrency = "USD")
    {
        if (!CurrencyService.IsSupported(targetCurrency))
        {
            ModelState.AddModelError(
                nameof(targetCurrency),
                "Currency must be PLN, USD, EUR, GBP or JPY.");

            return ValidationProblem();
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var transactions = await _context.Transactions
            .Where(transaction => transaction.UserId == userId)
            .ToListAsync();

        try
        {
            var needsConversion = transactions.Any(transaction =>
                (transaction.Type == "Income" || transaction.Type == "Expense") &&
                transaction.Currency != targetCurrency);

            IReadOnlyDictionary<string, decimal> rates = needsConversion
                ? await _currencyService.GetRatesAsync()
                : new Dictionary<string, decimal>();

            var totalIncome = Math.Round(
                transactions
                    .Where(transaction => transaction.Type == "Income")
                    .Sum(transaction => CurrencyService.Convert(
                        transaction.Amount,
                        transaction.Currency,
                        targetCurrency,
                        rates)),
                2,
                MidpointRounding.AwayFromZero);

            var totalExpense = Math.Round(
                transactions
                    .Where(transaction => transaction.Type == "Expense")
                    .Sum(transaction => CurrencyService.Convert(
                        transaction.Amount,
                        transaction.Currency,
                        targetCurrency,
                        rates)),
                2,
                MidpointRounding.AwayFromZero);

            return Ok(new
            {
                TotalIncome = totalIncome,
                TotalExpense = totalExpense,
                Balance = totalIncome - totalExpense,
                Currency = targetCurrency
            });
        }
        catch (Exception error) when (error is InvalidOperationException or OverflowException)
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Exchange rates are unavailable.",
                detail: "Could not calculate the summary. Please try again later.");
        }
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
