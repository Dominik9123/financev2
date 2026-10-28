using System.Text;

namespace backend.Validation;

public static class CategoryNames
{
    private static readonly HashSet<string> ReservedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Housing", "Food", "Transport", "Entertainment", "Shopping",
        "HealthCare", "Travel", "Savings", "Education", "Debt's", "Income", "All"
    };

    public static string Normalize(string name) => name.Trim().Normalize(NormalizationForm.FormC);

    public static bool IsReserved(string name) => ReservedNames.Contains(Normalize(name));

    public static bool Equal(string left, string right) =>
        StringComparer.OrdinalIgnoreCase.Equals(Normalize(left), Normalize(right));
}
