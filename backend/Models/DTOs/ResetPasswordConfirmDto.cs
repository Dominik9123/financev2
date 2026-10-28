using System.ComponentModel.DataAnnotations;
using backend.Validation;

namespace backend.Models.Dtos
{
    public class ResetPasswordConfirmDto
    {
        [Required]
        [EmailAddress]
        [StringLength(254)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [StringLength(4096)]
        public string Token { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [StrongPassword]
        public string NewPassword { get; set; } = string.Empty;
    }
}
