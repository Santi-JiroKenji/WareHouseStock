namespace WareHouseStock.Api.Models;

public sealed class StockTransaction
{
    public Guid Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Type { get; set; } = "";
    public int Quantity { get; set; }
    public string Reference { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime CreatedDate { get; set; }
}
