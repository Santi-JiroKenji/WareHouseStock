using Microsoft.EntityFrameworkCore;
using WareHouseStock.Api.Models;

namespace WareHouseStock.Api.Data;

public sealed class WarehouseDbContext(DbContextOptions<WarehouseDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        var product = builder.Entity<Product>();
        product.ToTable("Products", "dbo", table =>
        {
            table.HasCheckConstraint("CK_Products_RowVersion", "[RowVersion] >= 1");
            table.HasCheckConstraint("CK_Products_Quantity", "[Quantity] BETWEEN 0 AND 1000000000");
            table.HasCheckConstraint("CK_Products_Minimum", "[Minimum] BETWEEN 0 AND 1000000000");
        });

        product.HasIndex(p => p.Sku).IsUnique();
        product.Property(p => p.RowVersion).IsConcurrencyToken().ValueGeneratedNever();
        product.Property(p => p.Sku).HasMaxLength(60).IsRequired();
        product.Property(p => p.Name).HasMaxLength(150).IsRequired();
        product.Property(p => p.Category).HasMaxLength(60).IsRequired();
        product.Property(p => p.Unit).HasMaxLength(60).IsRequired();
        product.Property(p => p.Location).HasMaxLength(60).IsRequired();

        var stockTransaction = builder.Entity<StockTransaction>();
        stockTransaction.ToTable("StockTransactions", "dbo", table =>
        {
            table.HasCheckConstraint("CK_StockTransactions_Type", "[Type] IN ('in','out')");
            table.HasCheckConstraint("CK_StockTransactions_Quantity", "[Quantity] BETWEEN 1 AND 1000000000");
        });

        stockTransaction.Property(m => m.Id).ValueGeneratedNever();
        stockTransaction.Property(m => m.Type).HasMaxLength(3).IsRequired();
        stockTransaction.Property(m => m.Reference).HasMaxLength(100).IsRequired();
        stockTransaction.Property(m => m.Note).HasMaxLength(500).IsRequired();
        stockTransaction.Property(m => m.CreatedDate).HasColumnType("datetime")
            .HasConversion(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        stockTransaction.HasIndex(m => m.CreatedDate);
        stockTransaction.HasIndex(m => new { m.ProductId, m.CreatedDate });
        stockTransaction.HasOne(m => m.Product).WithMany().HasForeignKey(m => m.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
