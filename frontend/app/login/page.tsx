"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Boxes, Eye, EyeOff, LockKeyhole, HousePlus } from 'lucide-react';
import { useSession } from '@/components/auth/session-provider';

export default function LoginPage() {
  const { user, loading, login } = useSession();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lock = useRef(false);

  useEffect(() => { if (user) router.replace('/'); }, [user, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); 
    if (lock.current) 
      return;
    
    const form = new FormData(event.currentTarget);
    lock.current = true; 
    setBusy(true); 
    setError('');
    try { 
      await login(String(form.get('username')).trim(), String(form.get('password'))); router.replace('/'); 
    }
    catch (e) { 
      setError(e instanceof Error ? e.message : 'เข้าสู่ระบบไม่สำเร็จ'); 
    }
    finally { 
      lock.current = false; setBusy(false); 
    }
  }
  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand">
        <HousePlus/> WareHouse Stock
      </div>
      <div>
        <span className="login-eyebrow">WAREHOUSE MANAGEMENT</span>
        <div className="login-concept">
          จัดการเเละติดตาม<br/>ความเคลื่อนไหว<br/>ในคลังเดียวกัน
        </div>
        <p>รับเข้า เบิกออก และติดตามสินค้าคงคลัง<br/>พร้อมข้อมูลที่อัปเดตจากการทำงานของคุณ</p>
      </div>
      <small>WareHouse Stock Management</small>
    </section>

    <section className="login-panel">
      <form className="login-form" onSubmit={submit}>
        <span className="login-lock"><LockKeyhole size={24}/></span>
        <div className="eyebrow">
          ยินดีต้อนรับกลับ
        </div>
        <h2>เข้าสู่ระบบจัดการคลังสินค้า</h2><p>กรอกบัญชีของคุณเพื่อเริ่มต้นใช้งาน</p>
        <label htmlFor="username">ชื่อผู้ใช้</label>
        <input id="username" name="username" autoComplete="username" placeholder="ชื่อผู้ใช้" required maxLength={80} disabled={busy}/>
        <label htmlFor="password">รหัสผ่าน</label>
        <div className="password-field">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="รหัสผ่าน" required maxLength={128} disabled={busy}/>
          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword}>
            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
          </button>
        </div>
        {
          error && 
          <div className="error" role="alert">
            {error}
          </div>
        }
        <button className="button primary login-submit" disabled={busy || loading || !!user}>
          {busy ? 'กำลังเข้าสู่ระบบ...' : loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}<ArrowRight size={18}/>
        </button>
        <div className="login-hint">
          สำหรับผู้ดูแลคลังสินค้า · WareHouse Stock
        </div>
      </form>
    </section>
  </main>;
}
