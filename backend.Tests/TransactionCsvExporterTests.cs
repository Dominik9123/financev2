using System.Globalization;
using System.Text;
using backend.Models;
using backend.Services;
using Microsoft.VisualBasic.FileIO;
using Xunit;

namespace Backend.Tests;

public class TransactionCsvExporterTests
{
    public static Transaction Sample(string title = "Salary") => new()
    {
        UserId = "test-user", Title = title, Amount = 12.50m, Currency = "USD",
        Category = "Income", Type = "Income", Date = new DateTime(2026, 10, 28)
    };

    internal static List<string[]> ReadRows(byte[] content)
    {
        using var stream = new MemoryStream(content);
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        using var parser = new TextFieldParser(reader)
        {
            TextFieldType = FieldType.Delimited, HasFieldsEnclosedInQuotes = true, TrimWhiteSpace = false
        };
        parser.SetDelimiters(";");
        var rows = new List<string[]>();
        while (!parser.EndOfData) rows.Add(parser.ReadFields()!);
        return rows;
    }

    [Fact]
    public void EmptyExportContainsOnlyTheSixColumnHeaderAndUtf8Bom()
    {
        var bytes = TransactionCsvExporter.Create(Array.Empty<Transaction>());
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, bytes.Take(3).ToArray());
        var header = Assert.Single(ReadRows(bytes));
        Assert.Equal(new[] { "Date", "Title", "Amount", "Currency", "Category", "Type" }, header);
    }

    [Theory]
    [InlineData("pl-PL")]
    [InlineData("en-US")]
    public void ExportPreservesTextCurrencyAndOriginalPrecisionAcrossCultures(string culture)
    {
        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);
            var transaction = Sample("Żywność; \"lunch\"\r\nsecond line");
            transaction.Amount = 12.3456m; // Preserve historical values; do not round during export.
            var rows = ReadRows(TransactionCsvExporter.Create(new[] { transaction }));
            Assert.Equal(2, rows.Count);
            Assert.Equal(new[] { "2026-10-28", transaction.Title, "12.3456", "USD", "Income", "Income" }, rows[1]);
        }
        finally { CultureInfo.CurrentCulture = original; }
    }

    [Theory]
    [InlineData("=1+1")]
    [InlineData("+1+1")]
    [InlineData("-1+1")]
    [InlineData("@SUM(1;2)")]
    [InlineData("  =1+1")]
    [InlineData("\t=1+1")]
    [InlineData("\r=1+1")]
    [InlineData("\n=1+1")]
    [InlineData("＝1+1")]
    [InlineData("＋1+1")]
    [InlineData("－1+1")]
    [InlineData("＠SUM(1;2)")]
    public void FormulaLikeTextIsPrefixedWithoutLosingTheOriginalContent(string text)
    {
        var transaction = Sample(text);
        transaction.Category = text;
        var row = ReadRows(TransactionCsvExporter.Create(new[] { transaction }))[1];
        Assert.Equal("'" + text, row[1]);
        Assert.Equal("'" + text, row[4]);
        Assert.Equal(6, row.Length);
    }

    [Fact]
    public void EmbeddedQuotesAndSeparatorsCannotCreateAdditionalCells()
    {
        const string text = "Report\";=1+1;\"end";
        var row = ReadRows(TransactionCsvExporter.Create(new[] { Sample(text) }))[1];
        Assert.Equal(text, row[1]);
        Assert.Equal(6, row.Length);
    }

    [Fact]
    public void HistoricalNegativeAmountsRemainNumeric()
    {
        var transaction = Sample();
        transaction.Amount = -12.5m;
        Assert.Equal("-12.5", ReadRows(TransactionCsvExporter.Create(new[] { transaction }))[1][2]);
    }
}
