using Microsoft.AspNetCore.Mvc;
using WareHouseStock.Api.Contracts;
using WareHouseStock.Api.Models;
using WareHouseStock.Api.Services;

namespace WareHouseStock.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(InventoryService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<Product>>> GetAll(CancellationToken ct) =>
        Ok(await service.GetProductsAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Product>> GetById(int id, CancellationToken ct)
    {
        var product = await service.GetProductAsync(id, ct);
        return product is null ? NotFound(new ProblemDetails { Status = 404, Title = "ไม่พบสินค้า" }) : Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<Product>> Create(CreateProductRequest request, CancellationToken ct)
    {
        var product = await service.CreateProductAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Product>> Update(int id, UpdateProductRequest request, CancellationToken ct) =>
        Ok(await service.UpdateProductAsync(id, request, ct));
}
