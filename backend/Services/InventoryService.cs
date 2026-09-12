using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using WareHouseStock.Api.Contracts;
using WareHouseStock.Api.Data;
using WareHouseStock.Api.Errors;
using WareHouseStock.Api.Models;

namespace WareHouseStock.Api.Services;

public sealed class InventoryService(WarehouseDbContext db)
{
    public Task<List<Product>> GetProductsAsync(CancellationToken ct) =>
        db.Products.AsNoTracking().OrderBy(p => p.Sku).ToListAsync(ct);

    public Task<Product?> GetProductAsync(int id, CancellationToken ct) =>
        db.Products.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct);

    public Task<List<StockTransactionResponse>> GetStockTransactionsAsync(CancellationToken ct) =>
        db.StockTransactions.AsNoTracking()
            .OrderByDescending(m => m.CreatedDate).ThenByDescending(m => m.Id)
            .Select(m => new StockTransactionResponse(m.Id, m.ProductId, m.Product.Name,
                m.Type, m.Quantity, m.Reference, m.Note, m.CreatedDate)).ToListAsync(ct);

    public async Task<Product> CreateProductAsync(CreateProductRequest request, CancellationToken ct)
    {
        var product = new Product
        {
            Sku = request.Sku.Trim(), Name = request.Name.Trim(),
            Category = request.Category.Trim(), Unit = request.Unit.Trim(),
            Location = request.Location.Trim(), Minimum = request.Minimum, Quantity = 0
        };
        db.Products.Add(product);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException e) when (IsUniqueViolation(e))
        {
            throw new ApiException(409, "รหัสสินค้านี้มีอยู่แล้ว");
        }
        return product;
    }

    public async Task<Product> UpdateProductAsync(int id, UpdateProductRequest request, CancellationToken ct)
    {
        var expectedVersion = request.RowVersion;
        if (expectedVersion < 1) throw new ApiException(400, "rowVersion ต้องเป็นจำนวนเต็มบวก");

        var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) throw new ApiException(404, "ไม่พบสินค้า");
        if (product.RowVersion != expectedVersion)
            throw new ApiException(409, "สินค้าเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุดและแก้ไขอีกครั้ง");

        product.Sku = request.Sku.Trim();
        product.Name = request.Name.Trim();
        product.Category = request.Category.Trim();
        product.Unit = request.Unit.Trim();
        product.Location = request.Location.Trim();
        product.Minimum = request.Minimum;
        db.Entry(product).Property(p => p.RowVersion).OriginalValue = expectedVersion;

        product.RowVersion = NextVersion(product.RowVersion);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ApiException(409, "สินค้าเปลี่ยนแปลงระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดและแก้ไขอีกครั้ง");
        }
        catch (DbUpdateException e) when (IsUniqueViolation(e))
        {
            throw new ApiException(409, "รหัสสินค้านี้มีอยู่แล้ว");
        }
        return product;
    }

    public async Task<StockTransactionResponse> CreateStockTransactionAsync(CreateStockTransactionRequest request, CancellationToken ct)
    {
        if (request.RequestId == Guid.Empty)
            throw new ApiException(400, "requestId ต้องเป็น UUID ที่ไม่ใช่ค่าว่าง");

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        var product = await db.Products.FromSqlInterpolated(
            $"SELECT * FROM dbo.Products WITH (UPDLOCK, ROWLOCK) WHERE Id = {request.ProductId}")
            .SingleOrDefaultAsync(ct);
        if (product is null) throw new ApiException(404, "ไม่พบสินค้า");

        var reference = request.Reference?.Trim() ?? "";
        var note = request.Note?.Trim() ?? "";
        var existing = await db.StockTransactions.AsNoTracking().SingleOrDefaultAsync(m => m.Id == request.RequestId, ct);
        if (existing is not null)
        {
            if (existing.ProductId != request.ProductId || existing.Type != request.Type
                || existing.Quantity != request.Quantity || existing.Reference != reference || existing.Note != note)
                throw new ApiException(409, "requestId นี้ถูกใช้กับข้อมูลรายการอื่นแล้ว");
            await transaction.CommitAsync(ct);
            return ToResponse(existing, product.Name);
        }

        if (request.Type == "out" && product.Quantity < request.Quantity)
            throw new ApiException(409, "ยอดสินค้าไม่เพียงพอสำหรับการเบิก");
        if (request.Type == "in" && product.Quantity > 1_000_000_000 - request.Quantity)
            throw new ApiException(409, "ยอดคงเหลือต้องไม่เกิน 1,000,000,000");

        product.RowVersion = NextVersion(product.RowVersion);
        product.Quantity += request.Type == "in" ? request.Quantity : -request.Quantity;
        var stockTransaction = new StockTransaction
        {
            Id = request.RequestId, ProductId = product.Id, Type = request.Type,
            Quantity = request.Quantity, Reference = reference, Note = note,
            CreatedDate = DateTime.UtcNow
        };
        db.StockTransactions.Add(stockTransaction);
        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(ct);
            throw new ApiException(409, "สินค้าเปลี่ยนแปลงระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดและลองอีกครั้ง");
        }
        catch (DbUpdateException e) when (IsUniqueViolation(e))
        {
            await transaction.RollbackAsync(ct);
            throw new ApiException(409, "requestId นี้ถูกบันทึกแล้ว กรุณาตรวจสอบประวัติรายการ");
        }
        return ToResponse(stockTransaction, product.Name);
    }

    private static int NextVersion(int current)
    {
        if (current < 1 || current == int.MaxValue)
            throw new ApiException(409, "เลขเวอร์ชันสินค้าไม่สามารถเพิ่มได้ กรุณาติดต่อผู้ดูแลระบบ");
        return current + 1;
    }

    private static bool IsUniqueViolation(DbUpdateException e) =>
        e.InnerException is SqlException { Number: 2601 or 2627 };

    private static StockTransactionResponse ToResponse(StockTransaction m, string name) =>
        new(m.Id, m.ProductId, name, m.Type, m.Quantity, m.Reference, m.Note, m.CreatedDate);
}
