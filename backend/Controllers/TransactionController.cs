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