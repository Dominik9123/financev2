using System.ComponentModel.DataAnnotations;

namespace backend.Models
{
    public class Category
    {
        public int Id { get; set; }

        [Required]
        [StringLength(25)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string UserId { get; set; } = string.Empty;
    }

    // DTO do odbierania danych z frontendu
    public class CategoryDto
    {
        public string Name { get; set; } = string.Empty;
    }
}