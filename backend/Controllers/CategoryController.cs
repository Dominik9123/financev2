using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models;
using backend.Models.Dtos;
using System.Security.Claims;
using System.Data;
using backend.Validation;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CategoryController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoryController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var categories = await _context.Categories
            .Where(c => c.UserId == userId)
            .ToListAsync();
        return Ok(categories);
    }

    [HttpPost]
    public async Task<IActionResult> AddCategory([FromBody] CategoryDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();
        var name = CategoryNames.Normalize(dto.Name);
        if (CategoryNames.IsReserved(name))
        {
            ModelState.AddModelError(nameof(dto.Name), "This category name is reserved or already exists among the default categories.");
            return ValidationProblem(statusCode: StatusCodes.Status409Conflict);
        }

        // SQLite starts a write transaction before the duplicate check, so concurrent
        // requests cannot both pass the check and insert the same name.
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var existingNames = await _context.Categories
            .Where(category => category.UserId == userId)
            .Select(category => category.Name)
            .ToListAsync();
        if (existingNames.Any(existing => CategoryNames.Equal(existing, name)))
        {
            ModelState.AddModelError(nameof(dto.Name), "This category already exists.");
            return ValidationProblem(statusCode: StatusCodes.Status409Conflict);
        }

        var category = new Category
        {
            Name = name,
            UserId = userId
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(category);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return NotFound();

        if (category.UserId != User.FindFirstValue(ClaimTypes.NameIdentifier))
            return Unauthorized();

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
        return Ok();
    }
}
