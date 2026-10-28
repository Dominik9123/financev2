using System.ComponentModel.DataAnnotations;

namespace backend.Models.Dtos
{
    public class ForgotPasswordDto
    {
        [Required]
        [EmailAddress]
        [StringLength(254)]
        public string Email { get; set; } = string.Empty;
    }
}
