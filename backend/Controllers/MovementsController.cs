using Microsoft.AspNetCore.Mvc;
using WareHouseStock.Api.Contracts;
using WareHouseStock.Api.Services;

namespace WareHouseStock.Api.Controllers;

[ApiController]
[Route("api/stockTransactions")]
public sealed class StockTransactionsController(InventoryService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<StockTransactionResponse>>> GetAll(CancellationToken ct) =>
        Ok(await service.GetStockTransactionsAsync(ct));

    [HttpPost]
    public async Task<ActionResult<StockTransactionResponse>> Create(CreateStockTransactionRequest request, CancellationToken ct) =>
        Ok(await service.CreateStockTransactionAsync(request, ct));
}
