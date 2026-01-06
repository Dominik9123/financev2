namespace backend.Models;

public class Transaction
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public User? User { get; set; }

    public required string Title { get; set; }
    public required decimal Amount { get; set; }

    public string Currency { get; set; } = "USD";

    public required string Category { get; set; }
    public required string Type { get; set; } // "Income" lub "Expense"
    public DateTime Date { get; set; } = DateTime.UtcNow;
}