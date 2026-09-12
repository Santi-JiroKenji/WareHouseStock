namespace WareHouseStock.Api.Models;

public sealed class Product
{
    public int Id { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Unit { get; set; } = "";
    public string Location { get; set; } = "";
    public int Minimum { get; set; }
    public int Quantity { get; set; }
    public int RowVersion { get; set; } = 1;
}
