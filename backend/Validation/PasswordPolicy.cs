using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace backend.Validation;

public static class PasswordPolicy
{
    public const int MinimumLength = 8;
    public const int MaximumLength = 128;

    public static void ConfigureIdentity(IdentityOptions options)
    {
        options.Password.RequiredLength = MinimumLength;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = false;
        options.Password.RequireNonAlphanumeric = true;
        options.User.RequireUniqueEmail = true;
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    }
}

[AttributeUsage(AttributeTargets.Property)]
public sealed class StrongPasswordAttribute : ValidationAttribute
{
    public StrongPasswordAttribute()
        : base("Password must contain 8–128 characters, an uppercase letter, a digit and a special character.") { }

    public override bool IsValid(object? value)
    {
        // Required handles missing values separately.
        if (value is null) return true;
        return value is string password
            && password.Length >= PasswordPolicy.MinimumLength
            && password.Length <= PasswordPolicy.MaximumLength
            && password.Any(c => c is >= 'A' and <= 'Z')
            && password.Any(c => c is >= '0' and <= '9')
            && password.Any(c => !(c is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or >= '0' and <= '9'));
    }
}
