using System.ComponentModel.DataAnnotations;
using System.Globalization;
using backend.Models;
using backend.Models.Dtos;
using backend.Validation;
using Xunit;

namespace Backend.Tests;

public class ValidationTests
{
    public static TransactionDto ValidTransaction() => new()
    {
        Title = "Salary", Amount = 12.34m, Currency = "PLN", Category = "Income",
        Type = "Income", Date = new DateTime(2026, 10, 28, 12, 0, 0, DateTimeKind.Utc)
    };

    private static List<ValidationResult> Errors(object dto)
    {
        var errors = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), errors, validateAllProperties: true);
        return errors;
    }

    [Theory]
    [InlineData("pl-PL")]
    [InlineData("en-US")]
    public void AmountRulesWorkIndependentlyOfCulture(string culture)
    {
        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);
            foreach (var amount in new[] { 0.01m, 10m, 10.10m, 10.1200m, 1000000000m })
            {
                var dto = ValidTransaction();
                dto.Amount = amount;
                Assert.Empty(Errors(dto));
            }
            foreach (var amount in new[] { -1m, 0m, 0.001m, 10.123m, 1000000000.01m })
            {
                var dto = ValidTransaction();
                dto.Amount = amount;
                Assert.Contains(Errors(dto), error => error.MemberNames.Contains("Amount"));
            }
        }
        finally { CultureInfo.CurrentCulture = original; }
    }

    [Theory]
    [InlineData("Title", " ")]
    [InlineData("Title", null)]
    [InlineData("Category", "")]
    [InlineData("Category", null)]
    [InlineData("Currency", "BTC")]
    [InlineData("Currency", "pln")]
    [InlineData("Currency", null)]
    [InlineData("Type", "Other")]
    [InlineData("Type", null)]
    public void InvalidTransactionFieldsAreRejected(string field, string? value)
    {
        var dto = ValidTransaction();
        typeof(TransactionDto).GetProperty(field)!.SetValue(dto, value);
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains(field));
    }

    [Fact]
    public void MissingAndDefaultDatesAreRejected()
    {
        var dto = ValidTransaction();
        dto.Date = null;
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("Date"));
        dto.Date = DateTime.MinValue;
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("Date"));
    }

    [Theory]
    [InlineData("Title", 101)]
    [InlineData("Category", 26)]
    public void OversizedTransactionFieldsAreRejected(string field, int length)
    {
        var dto = ValidTransaction();
        typeof(TransactionDto).GetProperty(field)!.SetValue(dto, new string('A', length));
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains(field));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345678901234567890123456")]
    public void InvalidCategoryNamesAreRejected(string? name)
    {
        Assert.Contains(Errors(new CategoryDto { Name = name! }), error => error.MemberNames.Contains("Name"));
    }

    [Theory]
    [InlineData("FirstName", " ")]
    [InlineData("FirstName", null)]
    [InlineData("LastName", "")]
    [InlineData("LastName", null)]
    [InlineData("Email", "not-an-email")]
    [InlineData("Email", null)]
    [InlineData("Password", null)]
    [InlineData("Password", "Ab1!")]
    [InlineData("Password", "abcdefgh1!")]
    [InlineData("Password", "Abcdefgh!")]
    [InlineData("Password", "Abcdefgh1")]
    public void InvalidRegistrationFieldsAreRejected(string field, string? value)
    {
        var dto = new RegisterDto { FirstName = "Anna", LastName = "Kowalska", Email = "anna@example.test", Password = "ValidPass1!" };
        typeof(RegisterDto).GetProperty(field)!.SetValue(dto, value);
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains(field));
    }

    [Fact]
    public void RegistrationLimitsAndEmailTrimmingAreValidated()
    {
        var dto = new RegisterDto
        {
            FirstName = new string('A', 50), LastName = "O’Connor", Email = " anna@example.test ",
            Password = new string('A', 125) + "a1!"
        };
        Assert.Empty(Errors(dto));
        Assert.Equal("anna@example.test", dto.Email);
        dto.FirstName += "A";
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("FirstName"));
        dto.FirstName = "Anna";
        dto.LastName = new string('A', 51);
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("LastName"));
        dto.LastName = "Kowalska";
        dto.Email = new string('a', 245) + "@example.test";
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("Email"));
        dto.Email = "anna@example.test";
        dto.Password += "A";
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("Password"));
    }

    [Fact]
    public void ResetUsesTheSamePasswordRulesAsRegistration()
    {
        var dto = new ResetPasswordConfirmDto { Email = "anna@example.test", Token = "token", NewPassword = "1234" };
        Assert.Contains(Errors(dto), error => error.MemberNames.Contains("NewPassword"));
        dto.NewPassword = "ValidPass1!";
        Assert.Empty(Errors(dto));
    }

    [Fact]
    public void CategoryMatchingHandlesCaseWhitespaceAndUnicode()
    {
        Assert.True(CategoryNames.Equal("  ŻYWNOŚĆ ", "żywność"));
        Assert.True(CategoryNames.Equal("Caf\u00e9", "Cafe\u0301"));
        Assert.True(CategoryNames.IsReserved(" food "));
    }
}
