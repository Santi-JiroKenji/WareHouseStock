using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace WareHouseStock.Api.Errors;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var status = exception is ApiException api ? api.StatusCode
            : exception is SqlException ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status500InternalServerError;

        var message = exception is ApiException ? exception.Message
            : status == 503 ? "ไม่สามารถติดต่อฐานข้อมูลได้ กรุณาลองอีกครั้ง"
            : "เกิดข้อผิดพลาดภายในระบบ";

        if (status >= 500) 
            logger.LogError(exception, "Inventory request failed: {TraceId}", context.TraceIdentifier);
        
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status,
            Title = message,
            Extensions = { ["traceId"] = context.TraceIdentifier }
        }, cancellationToken: ct);
        
        return true;
    }
}
