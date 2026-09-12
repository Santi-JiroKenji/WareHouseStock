using System.ComponentModel.DataAnnotations;

namespace WareHouseStock.Api.Contracts;

public class CreateProductRequest
{
    [Required, MaxLength(60)] 
    public string Sku { get; init; } = "";
    [Required, MaxLength(150)] 
    public string Name { get; init; } = "";
    [Required, MaxLength(60)] 
    public string Category { get; init; } = "";
    [Required, MaxLength(60)] 
    public string Unit { get; init; } = "";
    [Required, MaxLength(60)] 
    public string Location { get; init; } = "";
    [Range(0, 1_000_000_000)] 
    public int Minimum { get; init; }
}

public sealed class UpdateProductRequest : CreateProductRequest
{
    [Range(1, int.MaxValue)] 
    public int RowVersion { get; init; }
}

public sealed class CreateStockTransactionRequest
{
    public Guid RequestId { get; init; }
    [Range(1, int.MaxValue)] 
    public int ProductId { get; init; }
    [Required, RegularExpression("^(in|out)$")] 
    public string Type { get; init; } = "";
    [Range(1, 1_000_000_000)] 
    public int Quantity { get; init; }
    [MaxLength(100)] 
    public string? Reference { get; init; }
    [MaxLength(500)] 
    public string? Note { get; init; }
}

public sealed record StockTransactionResponse(
    Guid Id, int ProductId, string ProductName, string Type,
    int Quantity, string Reference, string Note, DateTime CreatedDate);
