using System.ComponentModel.DataAnnotations;

namespace backend.Models.Dtos;

public class CategoryDto
{
    private string _name = string.Empty;

    [Required(ErrorMessage = "Category name is required.")]
    [StringLength(25, ErrorMessage = "Category name cannot exceed 25 characters.")]
    public string Name
    {
        get => _name;
        set => _name = value?.Trim() ?? string.Empty;
    }
}
