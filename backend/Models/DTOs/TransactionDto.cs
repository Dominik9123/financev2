using System.ComponentModel.DataAnnotations;

namespace backend.Models.Dtos;

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
