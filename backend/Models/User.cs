namespace backend.Models;

using Microsoft.AspNetCore.Identity;

public class User : IdentityUser
{
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}