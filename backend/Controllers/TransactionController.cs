using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionController : ControllerBase
{
    private readonly AppDbContext _context;

    public TransactionController(AppDbContext context)
    {
        _context = context;
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
            Title = string.IsNullOrEmpty(dto.Title) ? "New Transaction" : dto.Title,
            Amount = dto.Amount,
            Category = dto.Category,
            Type = dto.Type,
            Date = dto.Date == default ? DateTime.UtcNow : dto.Date
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

        transaction.Title = updated.Title;
        transaction.Amount = updated.Amount;
        transaction.Category = updated.Category;
        transaction.Type = updated.Type;
        transaction.Date = updated.Date;

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
        // Wyciągamy ID zalogowanego użytkownika
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Pobieramy wszystkie transakcje należące tylko do tego użytkownika
        var userTransactions = _context.Transactions.Where(t => t.UserId == userId);

        // Usuwamy je zbiorczo
        _context.Transactions.RemoveRange(userTransactions);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Data reset successfully" });
    }
}

public class TransactionDto
{
    public string Title { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public DateTime Date { get; set; }
}