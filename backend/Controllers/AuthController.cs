using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using backend.Models;
using backend.Models.Dtos;
using Microsoft.AspNetCore.Authorization;
using backend.Services; // Dodane dla IEmailSender

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly IEmailSender _emailSender; // Nowe pole

    // Zaktualizowany konstruktor
    public AuthController(UserManager<User> userManager, SignInManager<User> signInManager, IEmailSender emailSender)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emailSender = emailSender;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var user = new User
        {
            UserName = dto.Email,
            Email = dto.Email,
            FirstName = dto.FirstName,
            LastName = dto.LastName
        };
        var result = await _userManager.CreateAsync(user, dto.Password);

        if (!result.Succeeded) return BadRequest(result.Errors);
        return Ok(new { Message = "User registered successfully" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null)
            return Unauthorized(new { message = "Niepoprawne dane!" });

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, false);
        if (!result.Succeeded)
            return Unauthorized(new { message = "Niepoprawne dane!" });

        await _signInManager.SignInAsync(user, isPersistent: dto.RememberMe);

        return Ok(new
        {
            message = "Login successful",
            username = user.UserName,
            firstName = user.FirstName
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { message = "Logged out successfully" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        return Ok(new
        {
            username = user.UserName,
            firstName = user.FirstName,
            lastName = user.LastName
        });
    }

    // --- NOWE METODY DO RESETU HASŁA ---

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);

        // Zwracamy Ok nawet jeśli użytkownik nie istnieje (ochrona przed wyciekiem adresów e-mail)
        if (user == null)
            return Ok(new { message = "If the email is correct, a reset link has been sent." });

        // Generowanie tokenu przez ASP.NET Core Identity
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        // Przygotowanie linku do Frontendu (React)
        var resetLink = $"http://localhost:3000/financev2/reset-password?token={Uri.EscapeDataString(token)}&email={user.Email}";

        // Wysłanie maila przez Mailtrap
        await _emailSender.SendEmailAsync(user.Email, "Reset Password - Finance Tracker",
            $"<h2>Reset Your Password</h2><p>Click the link below to set a new password:</p><a href='{resetLink}'>Reset Password</a>");

        return Ok(new { message = "Reset link sent successfully" });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordConfirmDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null) return BadRequest("Invalid request");

        // Walidacja tokenu i zmiana hasła w bazie SQLite
        var result = await _userManager.ResetPasswordAsync(user, dto.Token, dto.NewPassword);

        if (result.Succeeded)
            return Ok(new { message = "Password has been reset successfully" });

        return BadRequest(result.Errors);
    }
}