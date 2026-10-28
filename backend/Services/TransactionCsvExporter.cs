using System.Globalization;
using System.Text;
using backend.Models;

namespace backend.Services;

public static class TransactionCsvExporter
{
    public static byte[] Create(IEnumerable<Transaction> transactions)
    {
        var csv = new StringBuilder(
            "Date;Title;Amount;Currency;Category;Type\r\n");

        foreach (var transaction in transactions)
        {
            var fields = new[]
            {
                transaction.Date.ToString(
                    "yyyy-MM-dd", CultureInfo.InvariantCulture),
                EscapeText(transaction.Title),
                transaction.Amount.ToString(CultureInfo.InvariantCulture),
                EscapeText(transaction.Currency),
                EscapeText(transaction.Category),
                EscapeText(transaction.Type)
            };

            csv.Append(string.Join(";", fields));
            csv.Append("\r\n");
        }

        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);

        return encoding.GetPreamble()
            .Concat(encoding.GetBytes(csv.ToString()))
            .ToArray();
    }

    private static string EscapeText(string? value)
    {
        var text = value ?? string.Empty;
        var candidate = text.TrimStart();

        var startsLikeFormula =
            candidate.Length > 0 &&
            "=+-@＝＋－＠".Contains(candidate[0]);

        var startsWithControlCharacter =
            text.Length > 0 &&
            text[0] is '\t' or '\r' or '\n';

        if (startsLikeFormula || startsWithControlCharacter)
        {
            text = "'" + text;
        }

        return "\"" + text.Replace("\"", "\"\"") + "\"";
    }
}