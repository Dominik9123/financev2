using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models;
using System.Security.Claims;

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

    // Pobiera kategorie zalogowanego użytkownika
    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var categories = await _context.Categories
            .Where(c => c.UserId == userId)
            .ToListAsync();
        return Ok(categories);
    }

    // Dodaje nową kategorię
    [HttpPost]
    public async Task<IActionResult> AddCategory([FromBody] CategoryDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required");

        var category = new Category
        {
            Name = dto.Name,
            UserId = userId
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();
        return Ok(category);
    }

    // Usuwa konkretną kategorię
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return NotFound();

        // Sprawdzenie czy użytkownik usuwa swoją kategorię
        if (category.UserId != User.FindFirstValue(ClaimTypes.NameIdentifier))
            return Unauthorized();

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
        return Ok();
    }
}