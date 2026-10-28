using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using backend.Models;
using backend.Models.Dtos;
using Microsoft.AspNetCore.Authorization;
using backend.Services;
using Microsoft.AspNetCore.WebUtilities;
using System.Text.Encodings.Web;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        IEmailSender emailSender,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emailSender = emailSender;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var user = new User
        {
            UserName = dto.Email,
            Email = dto.Email,
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim()
        };
        var result = await _userManager.CreateAsync(user, dto.Password);

        if (!result.Succeeded) return BadRequest(result.Errors);
        return Ok(new { Message = "User registered successfully" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email.Trim());
        if (user == null)
            return Unauthorized(new { message = "Niepoprawne dane!" });

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
            return Unauthorized(new { message = "Niepoprawne dane!" });

        await _signInManager.SignInAsync(user, isPersistent: dto.RememberMe);

        return Ok(new
        {
            message = "Login successful",
            id = user.Id,
            email = user.Email,
            username = user.UserName,
            firstName = user.FirstName ?? string.Empty,
            lastName = user.LastName ?? string.Empty
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
            id = user.Id,
            email = user.Email,
            username = user.UserName,
            firstName = user.FirstName ?? string.Empty,
            lastName = user.LastName ?? string.Empty
        });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        const string resetRequestMessage =
            "If an account with this email exists, reset instructions have been sent.";

        var user = await _userManager.FindByEmailAsync(dto.Email);

        // Zwracamy Ok nawet jeśli użytkownik nie istnieje (ochrona przed wyciekiem adresów e-mail)
        if (user == null)
            return Ok(new { message = resetRequestMessage });

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        var resetUrl = _configuration["Frontend:PasswordResetUrl"]
            ?? throw new InvalidOperationException(
                "Frontend:PasswordResetUrl is not configured.");

        var resetLink = QueryHelpers.AddQueryString(
            resetUrl,
            new Dictionary<string, string?>
            {
                ["token"] = token,
                ["email"] = user.Email
            });

        var safeResetLink = HtmlEncoder.Default.Encode(resetLink);

        await _emailSender.SendEmailAsync(
            user.Email!,
            "Reset Password - Finance Tracker",
            $"<h2>Reset Your Password</h2>" +
            $"<p>Click the link below to set a new password:</p>" +
            $"<a href='{safeResetLink}'>Reset Password</a>");

        return Ok(new { message = resetRequestMessage });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordConfirmDto dto)
    {
        const string invalidLinkMessage =
            "This reset link is invalid, expired or has already been used. Request a new link.";

        var user = await _userManager.FindByEmailAsync(dto.Email);

        if (user == null)
        {
            ModelState.AddModelError(nameof(dto.Token), invalidLinkMessage);
            return ValidationProblem();
        }

        var result = await _userManager.ResetPasswordAsync(
            user, dto.Token, dto.NewPassword);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                if (error.Code == "InvalidToken")
                {
                    ModelState.AddModelError(
                        nameof(dto.Token), invalidLinkMessage);
                }
                else
                {
                    ModelState.AddModelError(
                        nameof(dto.NewPassword), error.Description);
                }
            }

            return ValidationProblem();
        }

        return Ok(new { message = "Password has been reset successfully" });
    }
}
