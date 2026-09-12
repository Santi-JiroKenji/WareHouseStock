-- New database only. Existing installations: stop the API and run 004 instead.
IF DB_ID(N'Warehouse') IS NULL CREATE DATABASE Warehouse;
GO
USE Warehouse;
GO
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.StockTransactions', N'U') IS NOT NULL
    THROW 50001, 'Tables already exist. For existing installations run 004-upgrade-date-version.sql.', 1;
BEGIN TRANSACTION;
CREATE TABLE dbo.Products (
 Id int IDENTITY PRIMARY KEY,
 Sku nvarchar(60) NOT NULL,
 Name nvarchar(150) NOT NULL,
 Category nvarchar(60) NOT NULL,
 Unit nvarchar(60) NOT NULL,
 Location nvarchar(60) NOT NULL,
 Minimum int NOT NULL CONSTRAINT CK_Products_Minimum CHECK (Minimum BETWEEN 0 AND 1000000000),
 Quantity int NOT NULL DEFAULT 0 CONSTRAINT CK_Products_Quantity CHECK (Quantity BETWEEN 0 AND 1000000000),
 RowVersion int NOT NULL CONSTRAINT DF_Products_RowVersion DEFAULT 1
     CONSTRAINT CK_Products_RowVersion CHECK (RowVersion >= 1)
);
CREATE UNIQUE INDEX IX_Products_Sku ON dbo.Products(Sku);
CREATE TABLE dbo.StockTransactions (
 Id uniqueidentifier PRIMARY KEY,
 ProductId int NOT NULL CONSTRAINT FK_StockTransactions_Products_ProductId REFERENCES dbo.Products(Id),
 Type nvarchar(3) NOT NULL CONSTRAINT CK_StockTransactions_Type CHECK (Type IN ('in','out')),
 Quantity int NOT NULL CONSTRAINT CK_StockTransactions_Quantity CHECK (Quantity BETWEEN 1 AND 1000000000),
 Reference nvarchar(100) NOT NULL,
 Note nvarchar(500) NOT NULL,
 CreatedDate datetime NOT NULL
);
CREATE INDEX IX_StockTransactions_CreatedDate ON dbo.StockTransactions(CreatedDate DESC) INCLUDE (ProductId,Type,Quantity);
CREATE INDEX IX_StockTransactions_ProductId ON dbo.StockTransactions(ProductId,CreatedDate DESC);
COMMIT;
GO
