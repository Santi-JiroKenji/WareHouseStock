using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WareHouseStock.Api.Data;
using WareHouseStock.Api.Errors;
using WareHouseStock.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var connection = builder.Configuration.GetConnectionString("Warehouse");
if (string.IsNullOrWhiteSpace(connection))
    throw new InvalidOperationException("Set ConnectionStrings:Warehouse using user-secrets or environment variables.");

builder.Services.AddControllers();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "WareHouseStock.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = false;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = 401;
            return context.Response.WriteAsJsonAsync(new { title = "กรุณาเข้าสู่ระบบ", status = 401 });
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = 403;
            return context.Response.WriteAsJsonAsync(new { title = "ไม่มีสิทธิ์ใช้งาน", status = 403 });
        };
    });

builder.Services.AddAuthorization(options => options.FallbackPolicy =
    new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddDbContext<WarehouseDbContext>(options => options.UseSqlServer(connection));
builder.Services.AddScoped<InventoryService>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:3000"])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();
app.UseExceptionHandler();
app.UseCors();

app.Use(async (context, next) =>
{
    if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)
        && !HttpMethods.IsOptions(context.Request.Method))
    {
        var origin = context.Request.Headers.Origin.ToString();
        var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
            ?? ["http://localhost:3000"];
        var ownOrigin = $"{context.Request.Scheme}://{context.Request.Host}";
        if (!string.IsNullOrEmpty(origin) && origin != ownOrigin && !allowedOrigins.Contains(origin))
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { title = "Origin is not allowed", status = 403 });
            return;
        }
    }
    await next(context);
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", async Task<IResult> (WarehouseDbContext db, CancellationToken ct) =>
{
    if (!await db.Database.CanConnectAsync(ct))
        return Results.Problem(statusCode: 503, title: "SQL Server is unavailable");

    await db.Products.AsNoTracking().Take(1).ToListAsync(ct);
    await db.StockTransactions.AsNoTracking().Take(1).ToListAsync(ct);
    return Results.Ok(new { status = "ok", database = "connected", schema = "ready" });
});
app.Run();

