using System.ComponentModel.DataAnnotations;

namespace backend.Services;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    [Required]
    public string Host { get; set; } = string.Empty;

    [Range(1, 65535)]
    public int Port { get; set; } = 587;

    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string FromEmail { get; set; } = string.Empty;

    public string FromName { get; set; } = "Finance Tracker";
}
