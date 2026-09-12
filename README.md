# ระบบจัดการคลังสินค้า (Web Application) Frontend (React, Nextjs)  Backend .Net C# เชื่อมต่อกับ Database (SQL Server)

# WareHouse Stock Management

UI ใช้ Oracle NetSuite เป็นแนวทาง

React/Next.js → ASP.NET Core 8 Web API → Entity Framework Core → SQL Server

## สิ่งที่มีในระบบจัดการคลังสินค้า
- login ด้วย demo auth (fix username และ password ไวใน code `/backend/Auth/DemoCredentials.cs`)
- เพิ่มสินค้า รับสินค้าเข้า เบิกสินค้าออก สินค้าคงคลัง ประวัติการรับและเบิก
- แสดงสอ้นค้าคงเหลือรวม เเละเเต่ละรยการ เเจ้งเตือนเมื่อมีสินค้าหมดหรือ ถึงจุดสั่งซื้อขั้นต่ำ
- ค้นหาสินค้า ด้วยรหัส ชื่อ หมวดหมู่ สถานะ
- export เป็นไฟล์ excel

## บัญชีสำหรับทดสอบ
ีusername: `admin`
password: `WareHouseStock1234`

* แก้แล้วต้อง restart Backend

## วิธีเตรียมเครื่องเพื่อรันโค๊ดเเละใช้งานบนเครื่อง
## 1. ติดตั้ง / อัปเกรดฐานข้อมูล
ต้องมี SQL Server เเละ ติดตั้ง SQL Server Express และ .NET 8 SDK
- Connect to SQL Server ==> |Server type: Database Engine| ==> |Server name: .\SQLEXPRESS หรือ localhost| ==> |Authentication: Windows Authentication|
- คลิ๊กขวาที่ Databases ==> New Databases ==> Database name: `Warehouse` ==> กด OK
- ใช้ SSMS รัน Query ใน `/database/001-create.sql`

## 2. ตั้งค่า Connection String และรัน API (Backend)
เปิด Terminal ในโฟลเดอร์ backend สำหรับ Windows Authentication กับ SQL Server Express:

```powershell or cmd
dotnet user-secrets set "ConnectionStrings:Warehouse" "Server=.\SQLEXPRESS;Database=Warehouse;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"
dotnet restore
dotnet build
dotnet run
```

หากเป็น default instance ใช้ Server=localhost หากใช้ SQL Authentication เปลี่ยนเป็นรูปแบบใน `database/README.md` โดยใส่ user/password จริงของคุณ

`dotnet run` ใช้ Development launch profile เพื่ออ่าน user-secrets หรือกำหนด `ConnectionStrings__Warehouse` เป็น environment variable แทนได้ ไม่มีการสร้างฐานข้อมูลอัตโนมัติเมื่อเริ่ม API ให้รัน SQL ตามข้อ 1 ก่อน

หลังเข้าสู่ระบบที่ Frontend แล้ว เปิด http://localhost:5080/api/health ใน browser เดียวกันควรได้ (ก่อน Login จะได้ 401):

```json
{"status":"ok","database":"connected","schema":"ready"}
```

## 3. รัน Frontend

เปิด Terminal อีกหนึ่งอันในโฟลเดอร์ frontend

```powershell
Copy-Item .env.example .env.local (**รันด้วย powershell ครั้งแรกครั้งเดียวหรือถ้ามีเปลี่ยน url)
```

(**รันด้วย cmd)
```cmd
npm ci
npm run dev
```

เปิด http://localhost:3000 แล้วเข้าสู่ระบบด้วยบัญชีด้านบน ค่าใน `.env.local` คือ `NEXT_PUBLIC_API_URL=http://localhost:5080/api` หากเปลี่ยน URL ให้ restart frontend
ใช้ `localhost` ทั้ง Frontend และ Backend อย่าสลับกับ `127.0.0.1` เพราะ session cookie ผูกกับ hostname ตั้ง `AllowedOrigins` ใน `backend/appsettings.json` ให้ตรงกับ origin ของ Frontend รวม port และใช้ scheme เดียวกัน (ตัวอย่างนี้ HTTP ทั้งคู่) CORS เปิด AllowCredentials และ fetch ใช้ credentials: include
หากย้าย server ให้วาง Frontend/API ใน same site หรือใช้ reverse proxy เพราะ cookie ใช้ SameSite=Strict ค่าเริ่มต้นนี้ไม่รองรับการแยกไปคนละ site

## 4. ทดลองการฝช้งาน read / insert / update
1. เพิ่ม รหัสสินค้าใหม่ เช่น BOX-001 → INSERT สินค้าโดยยอดเป็น 0
2. รับเข้า 10 → ยอดเป็น 10 และมีประวัติรับเข้า
3. เบิกออก 4 → ยอดเป็น 6 และมีประวัติเบิกออก
4. กดปุ่มดินสอในแถวสินค้า แก้ชื่อ ตำแหน่ง หรือขั้นต่ำ → UPDATE Products
5. รีเฟรชหน้า → โหลดค่าที่บันทึกจาก SQL Server อีกครั้ง
6. ปิดและเปิด Backend ใหม่ → ข้อมูลยังอยู่ใน SQL Server
