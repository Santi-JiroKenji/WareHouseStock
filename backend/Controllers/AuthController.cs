using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WareHouseStock.Api.Auth;

namespace WareHouseStock.Api.Controllers;

public sealed record LoginRequest
(
    [Required, StringLength(80)] string Username,
    [Required, StringLength(128)] string Password
);

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [Consumes("application/json")]
    public async Task<IActionResult> Login(LoginRequest input)
    {
        Response.Headers.CacheControl = "no-store";
        if (input.Username != DemoCredentials.Username || input.Password != DemoCredentials.Password)
            return Problem(statusCode: 401, title: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, DemoCredentials.Username), new Claim(ClaimTypes.Name, DemoCredentials.DisplayName)], CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false });
        return Ok(new { username = DemoCredentials.Username, displayName = DemoCredentials.DisplayName });
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(new { username = User.FindFirstValue(ClaimTypes.NameIdentifier), displayName = User.Identity!.Name });
    }

    [Authorize]
    [HttpPost("logout")]
    [Consumes("application/json")]
    public async Task<IActionResult> Logout()
    {
        Response.Headers.CacheControl = "no-store";
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { message = "ออกจากระบบแล้ว" });
    }
}
