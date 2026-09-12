"use client";
import { useEffect, useRef, useState } from 'react';
import { Boxes, Package, LayoutDashboard, ArrowDownLeft, ArrowUpRight, History, Search, Plus, Download, TriangleAlert, HousePlus, ChevronRight, SlidersHorizontal, Pencil, LogOut, PackageX } from 'lucide-react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Toaster, toast } from 'sonner';
import type { Product, StockTransaction } from '@/types/inventory';
import { inventoryApi } from '@/lib/inventory-api';
import { useSession } from '@/components/auth/session-provider';
import { SelectField as Pick } from './select-field';

const fmt = (n: number) => n.toLocaleString('th-TH');
const nav = [['dashboard', 'ภาพรวมคลังสินค้า', LayoutDashboard], 
            ['stock', 'สินค้าคงคลัง', Boxes], 
            ['in', 'รับสินค้าเข้า', ArrowDownLeft], 
            ['out', 'เบิกสินค้าออก', ArrowUpRight], 
            ['history', 'ประวัติรายการ', History]] as const;

export default function WarehouseApp() {
    const { user, logout } = useSession();
    const [signingOut, setSigningOut] = useState(false);
    async function signOut() { setSigningOut(true); try { await logout(); } catch (error) { toast.error(error instanceof Error ? error.message : 'ออกจากระบบไม่สำเร็จ'); } finally { setSigningOut(false); } }
    const [products, setProducts] = useState<Product[]>([]);
    const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
    const [view, setView] = useState('dashboard');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState('all');
    const [modal, setModal] = useState(''); 
    const [selected, setSelected] = useState('1'); 
    const [busy, setBusy] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editRevision, setEditRevision] = useState(0);
    const isProductForm = modal === 'product' || modal === 'edit';
    const low = products.filter(p => p.quantity > 0 && p.quantity <= p.minimum);
    const empty = products.filter(p => p.quantity === 0);
    const restockCount = low.length + empty.length;
    const filtered = products.filter(p =>
        (p.name + ' ' + p.sku).toLowerCase().includes(query.toLowerCase()) &&
        (category === 'all' || p.category === category) &&
        (status === 'all' ||
            (status === 'low' && p.quantity > 0 && p.quantity <= p.minimum) ||
            (status === 'empty' && p.quantity === 0) ||
            (status === 'restock' && p.quantity <= p.minimum) ||
            (status === 'ok' && p.quantity > p.minimum)));
    const history = stockTransactions.filter(m => (view !== 'in' && view !== 'out' || m.type === view) && (m.productName + ' ' + m.reference).toLowerCase().includes(query.toLowerCase()));
    
    function open(type: string, p?: Product) {
        if (loading || loadError || busy) { 
            toast.error("กรุณารอโหลดข้อมูล หรือกดโหลดใหม่ก่อนทำรายการ"); 
            return; 
        } 
        setEditingProduct(type === 'edit' ? p ?? null : null); setModal(type); setSelected(String(p?.id || products[0]?.id || '')); 
    }
    
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const submitLock = useRef(false);
    const pending = useRef<{ signature: string; requestId: string } | null>(null);

    async function loadData() {
        setLoading(true);
        try {
            const [nextProducts, nextStockTransactions] = await Promise.all([
                inventoryApi.products(), inventoryApi.stockTransactions(),
            ]);
            setProducts(nextProducts);
            setStockTransactions(nextStockTransactions);
            setLoadError('');
            return true;
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ');
            return false;
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { 
        void loadData(); 
    }, []);

    async function reloadEditingProduct() {
        if (!editingProduct || busy) return;
        setBusy(true);
        try {
            const latest = await inventoryApi.product(editingProduct.id);
            setEditingProduct(latest);
            setEditRevision(value => value + 1);
            setProducts(current => current.map(p => p.id === latest.id ? latest : p));
            toast.success('แทนค่าฟอร์มด้วยข้อมูลล่าสุดแล้ว');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setBusy(false);
        }
    }

    async function save(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitLock.current || loading || loadError) return;
        const form = new FormData(e.currentTarget);
        const value = (name: string) => String(form.get(name) ?? '').trim();
        submitLock.current = true;
        setBusy(true);
        try {
            if (isProductForm) {
                const input = {
                    sku: value('sku'), name: value('name'), category: value('category'),
                    unit: value('unit'), location: value('location'), minimum: Number(form.get('minimum')),
                };
                if (modal === 'edit') {
                    if (!editingProduct) throw new Error('ไม่พบสินค้า');
                    await inventoryApi.updateProduct(editingProduct.id, { ...input, rowVersion: editingProduct.rowVersion });
                } else {
                    await inventoryApi.createProduct(input);
                }
            } else {
                if (modal !== 'in' && modal !== 'out') throw new Error('ประเภทรายการไม่ถูกต้อง');
                const quantity = Number(form.get('quantity'));
                if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000000) {
                    throw new Error('กรุณาระบุจำนวนเต็มตั้งแต่ 1 ถึง 1,000,000,000');
                }
                const payload = {
                    productId: Number(selected), type: modal, quantity,
                    reference: value('reference'), note: value('note'),
                };
                const signature = JSON.stringify(payload);
                if (pending.current?.signature !== signature) {
                    pending.current = { signature, requestId: crypto.randomUUID() };
                }
                await inventoryApi.createStockTransaction({ ...payload, type: modal, requestId: pending.current.requestId });
                pending.current = null;
            }
            setModal('');
            toast.success('บันทึกรายการเรียบร้อยแล้ว');
            if (!await loadData()) {
                toast.warning('บันทึกสำเร็จ แต่โหลดข้อมูลล่าสุดไม่ได้ กรุณากดโหลดใหม่');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'ไม่สามารถบันทึกรายการได้');
        } finally {
            submitLock.current = false;
            setBusy(false);
        }
    }

    function csv() { 
        const stock = view === 'dashboard' || view === 'stock'; 
        const rows = stock ? [['รหัสสินค้า', 'ชื่อสินค้า', 'หมวดหมู่', 'คงเหลือ', 'หน่วย', 'ตำแหน่ง'], ...filtered.map(p => [p.sku, p.name, p.category, p.quantity, p.unit, p.location])] : 
            [['วันที่', 'สินค้า', 'ประเภท', 'จำนวน', 'อ้างอิง'], ...history.map(m => [m.createdDate, m.productName, m.type, m.quantity, m.reference])]; 
        const text = rows.map(r => r.map(v => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"').join(',')).join('\r\n'); 
        const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' })); 
        const a = document.createElement('a'); 
        
        a.href = url; 
        a.download = stock ? 'inventory.csv' : 'stockTransactions.csv'; 
        a.click(); 
        URL.revokeObjectURL(url); 
    }
    
    const isStock = view === 'dashboard' || view === 'stock';
    const counts: Record<string, number> = { 
        dashboard: products.length, 
        stock: products.reduce((a, p) => a + p.quantity, 0), 
        in: stockTransactions.filter(m => m.type === 'in').length, 
        out: stockTransactions.filter(m => m.type === 'out').length, 
        history: stockTransactions.length 
    };

    return <SidebarProvider className="warehouse-workspace" style={{ '--sidebar-width': '238px', '--sidebar-width-icon': '82px' } as React.CSSProperties}>
        <Toaster richColors position="top-right" />
        <Sidebar collapsible="icon" className="app-sidebar">
            <SidebarHeader>
                <div className="sidebar-toggle">
                    <SidebarTrigger aria-label="ย่อหรือขยายเมนู" title="ย่อหรือขยายเมนู" />
                    <span>เมนูคลังสินค้า</span>
                </div>
                <div className="brand">
                    <span><HousePlus size={25} /></span>
                    <div className="brand-name">WareHouse 
                        <span>Stock Management</span>
                        <small>WAREHOUSE WORKSPACE</small>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarMenu>
                    {
                        nav.map(([id, label, Icon]) => 
                        <SidebarMenuItem key={id}>
                            <SidebarMenuButton className="warehouse-nav-button group-data-[collapsible=icon]:size-[60px]! group-data-[collapsible=icon]:p-1!" 
                                aria-label={`${label} · ${fmt(counts[id])}`} tooltip={`${label} · ${fmt(counts[id])}`} 
                                isActive={view === id} onClick={() => { setView(id); setQuery(''); }}
                            >
                                <Icon />
                                <span className="nav-label">{label}</span>
                                <small className="nav-count">{fmt(counts[id])}</small>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        )
                    }
                </SidebarMenu>
            </SidebarContent>
            
            <SidebarFooter>
                <div className="profile">
                    <span>WH</span>
                    <div>
                        {<strong>{user?.displayName}</strong> }
                        <small>ผู้ดูแลคลังสินค้า</small>
                    </div>
                </div>
                {
                    <button className="logout-button" aria-label="ออกจากระบบ" title="ออกจากระบบ" onClick={() => void signOut()} disabled={signingOut || busy}>
                        <LogOut size={17} /><span>{signingOut ? 'กำลังออก...' : 'ออกจากระบบ'}</span>
                    </button>
                }
            </SidebarFooter>
        </Sidebar>

        <div className="main-shell">
            <main>
                <div className="page-heading">
                    <div className="page-title-group">
                        <SidebarTrigger className="mobile-menu-trigger" aria-label="เปิดเมนูคลังสินค้า" title="เปิดเมนูคลังสินค้า" />
                        <div>
                            <h1>{nav.find(x => x[0] === view)?.[1]}</h1>
                            <p>ตรวจสอบความเคลื่อนไหว และจัดการสินค้าในคลังของคุณ</p>
                        </div>
                    </div>
                    <div className="actions">
                        <button className="button" onClick={() => open('out')}>
                            <ArrowUpRight size={17} />เบิกสินค้าออก
                        </button>
                        <button className="button primary" onClick={() => open('in')}>
                            <Plus size={18} />รับสินค้าเข้า
                        </button>
                    </div>
                </div>
                
                {
                    loading && 
                    <div className="demo-banner" role="status">
                        กำลังโหลดข้อมูลจากคลังสินค้า...
                    </div>
                }
                {
                    loadError && 
                    <div className="error" role="alert">
                        {loadError} 
                        <button className="button" onClick={() => void loadData()} disabled={loading}>
                            โหลดใหม่
                        </button>
                    </div>
                }

                <div className="dashboard-grid">
                    <div className="workspace-content">
                        {
                            view === 'dashboard' && 
                            <section className="shortcuts panel" aria-label="ทางลัด">
                                <h2>จัดการคลังสินค้า</h2>
                                <div className="shortcut-grid">
                                    <button className="shortcut receive" onClick={() => open('in')}>
                                        <ArrowDownLeft size={27} />
                                        <strong>รับสินค้าเข้า</strong>
                                    </button>
                                    <button className="shortcut issue" onClick={() => open('out')}>
                                        <ArrowUpRight size={27} /><strong>เบิกสินค้าออก</strong>
                                    </button>
                                    <button className="shortcut inventory" onClick={() => { setView('stock'); setQuery(''); }}>
                                        <Boxes size={27} /><strong>สินค้าคงคลง</strong>
                                    </button>
                                    <button className="shortcut ledger" onClick={() => { setView('history'); setQuery(''); }}>
                                        <History size={27} /><strong>ประวัติรายการ</strong>
                                    </button>
                                </div>
                            </section>
                        }
                        {
                            restockCount > 0 && isStock && 
                            <div className="stock-alert">
                                <span>
                                    <TriangleAlert size={18} />
                                    <strong>มีสินค้า {restockCount} รายการที่ควรเติมสต็อก</strong>
                                    <span className="alert-detail">ตรวจสอบสินค้าเพื่อให้พร้อมเบิกใช้งาน</span>
                                </span>
                                <button onClick={() => { setStatus('restock'); setCategory('all'); setQuery(''); setView('stock'); }}>
                                    ดูรายการสินค้า 
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        }
                        
                        <section className="panel">
                            <div className="panel-heading">
                                <div>
                                    <h2>{isStock ? 'สินค้าคงคลัง' : view === 'in' ? 'รายการรับสินค้าเข้า' : view === 'out' ? 'รายการเบิกสินค้าออก' : 'ประวัติรับเข้าและเบิกออก'} 
                                        <span className="count">{isStock ? filtered.length : history.length}</span>
                                    </h2>
                                    <p>{isStock ? 'รายละเอียดสินค้าและยอดคงเหลือปัจจุบัน' : 'ตรวจสอบทุกรายการเคลื่อนไหวของสินค้า'}</p>
                                </div>
                                <div className="actions">
                                    <button className="button" disabled={loading || busy} onClick={() => void loadData()}>
                                        โหลดข้อมูลล่าสุด
                                    </button>
                                    <button className="button" onClick={csv}>
                                        <Download size={16} />ส่งออก CSV
                                    </button>
                                    {
                                        isStock ? 
                                            <button className="button" onClick={() => open('product')}>
                                                <Plus size={16} />เพิ่มสินค้า
                                            </button>
                                        : view !== 'history' &&
                                            <button className="button primary" onClick={() => open(view)}>
                                                <Plus size={16} />สร้างรายการ
                                            </button>
                                    }
                                </div>
                            </div>

                            <div className="filters">
                                <label className="search">
                                    <Search size={18} />
                                    <input aria-label="ค้นหารายการ" placeholder={isStock ? 'ค้นหาชื่อสินค้า หรือรหัสสินค้า...' : 'ค้นหาชื่อสินค้า หรือเลขอ้างอิง...'} value={query} onChange={e => setQuery(e.target.value)} />
                                </label>
                                {
                                    isStock && <>
                                        <Pick label="หมวดหมู่" value={category} onChange={setCategory} items={[{ value: 'all', label: 'ทุกหมวดหมู่' }, 
                                            ...Array.from(new Set(products.map(p => p.category))).map(c => ({ value: c, label: c }))]} 
                                        />
                                        <Pick label="สถานะสต็อก" value={status} onChange={setStatus} items={[{ value: 'all', label: 'ทุกสถานะ' }, 
                                            { value: 'ok', label: 'พร้อมเบิก' }, 
                                            { value: 'low', label: 'สินค้าใกล้หมด' }, 
                                            { value: 'empty', label: 'สินค้าหมด' }, 
                                            { value: 'restock', label: 'ควรเติมสต็อกทั้งหมด' }]} 
                                        />
                                        <SlidersHorizontal size={18} className="filter-icon" />
                                    </>
                                }
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {(
                                            isStock ? ['รหัส / ชื่อสินค้า', 'หมวดหมู่', 'ตำแหน่งจัดเก็บ', 'คงเหลือ', 'สถานะ', ''] 
                                            : ['วันและเวลา', 'สินค้า', 'ประเภม', 'จำนวน', 'เลขอ้างอิง', 'หมายเหตุ']).map((h, i) => 
                                                <TableHead key={i}>{h}</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {
                                        isStock ? filtered.map(p => 
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div className="product-cell">
                                                        <span className="product-icon">
                                                            <Package size={21} />
                                                        </span>
                                                        <div>
                                                            <strong>{p.name}</strong>
                                                            <small>{p.sku}</small>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="muted">
                                                    {p.category}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="location">
                                                        {p.location}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <b>{fmt(p.quantity)}</b>
                                                    <span className="unit">{p.unit}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={'badge ' + (p.quantity === 0 ? 'empty' : p.quantity <= p.minimum ? 'low' : 'ok')}>{p.quantity === 0 ? 'สินค้าหมด' : p.quantity <= p.minimum ? 'ใกล้หมด' : 'พร้อมเบิก'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <button className="row-action edit-action" aria-label={'แก้ไข ' + p.name} onClick={() => open('edit', p)}>
                                                        <Pencil size={17} />
                                                    </button>
                                                    <button className="row-action" aria-label={'เบิก ' + p.name} disabled={!p.quantity} onClick={() => open('out', p)}>
                                                        <ArrowUpRight size={17} />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ) 
                                        : history.map(m => 
                                            <TableRow key={m.id}>
                                                <TableCell>
                                                    {new Date(m.createdDate).toLocaleString('th-TH')}
                                                </TableCell>
                                                <TableCell>
                                                    {m.productName}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={'badge ' + (m.type === 'in' ? 'ok' : 'low')}>{m.type === 'in' ? 'รับเข้า' : 'เบิกออก'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <b>{m.type === 'in' ? '+' : '−'}{fmt(m.quantity)}</b>
                                                </TableCell>
                                                <TableCell>
                                                    {m.reference || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {m.note || '—'}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }
                                    {
                                        (isStock ? filtered : history).length === 0 && 
                                            <TableRow>
                                                <TableCell colSpan={6}>
                                                    <div className="empty-state">
                                                        <History />
                                                        <strong>{loading ? 'กำลังโหลด...' : loadError ? 'โหลดข้อมูลไม่ได้' : query ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการ'}</strong>
                                                        <span>เพิ่มสินค้า หรือสร้างรายการรับเข้าและเบิกออกเพื่อเริ่มต้น</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                    }
                                </TableBody>
                            </Table>
                            <div className="table-footer">
                                แสดง {isStock ? filtered.length : history.length} รายการ<span>ยอดคงเหลือปรับปรุงหลังบันทึกรายการ</span>
                            </div>
                        </section>
                    </div> 

                    <aside className="metrics" aria-label="สรุปคลังสินค้า">
                        {
                            [
                                { label: 'รายการสินค้าทั้งหมด', value: products.length, unit: 'รายการ', icon: Package, color: 'blue', sub: 'สินค้าที่ลงทะเบีนในคลัง' }, 
                                { label: 'จำนวนสินค้าคงคลัง', value: products.reduce((a, p) => a + p.quantity, 0), unit: 'หน่วย', icon: Boxes, color: 'purple', sub: 'รวมทุกสินค้าและหน่วยนับ' }, 
                                { label: 'รายการเคลื่อนไหว', value: stockTransactions.length, unit: 'รายการ', icon: History, color: 'green', sub: 'รับเข้าและเบิกออกทั้งหมด' }, 
                                { label: 'สินค้าใกล้หมด', value: low.length, unit: 'รายการ', icon: TriangleAlert, color: 'orange', sub: 'ยังมีคงเหลือ แต่ถึงจุดสั่งซื้อขั้นต่ำ' }, 
                                { label: 'สินค้าหมด', value: empty.length, unit: 'รายการ', icon: PackageX, color: 'red', sub: 'ยอดคงเหลือเป็นศูนย์' }
                            ].map(c => 
                            <article className={'metric metric-' + c.color} key={c.label}>
                                <div className="metric-top">
                                    {c.label}<span className={'icon-tile ' + c.color}><c.icon size={19} /></span>
                                </div>
                                <div className="metric-value">
                                    {fmt(c.value)}<span>{c.unit}</span>
                                </div>
                                <small>{c.sub}</small>
                            </article>
                            )
                        }
                    </aside>
                </div>

                <footer className="page-footer">
                    WareHouse Stock Management
                </footer>
            </main>
        </div>

        <Dialog open={!!modal} onOpenChange={o => !o && !busy && setModal('')}>
            <DialogContent>
                <DialogTitle>
                    {modal === 'edit' ? 'แก้ไขข้อมูลสินค้า' : modal === 'product' ? 'เพิ่มสินค้าใหม่' : modal === 'in' ? 'รับสินค้าเข้าคลัง' : 'เบิกสินค้าออกจากคลัง'}
                </DialogTitle>

                <DialogDescription>
                    {modal === 'edit' ? 'แก้ไขรายละเอียดสินค้า ยอดคงเหลือปรับผ่่านรายการรับเข้าและเบิกออก' : modal === 'product' ? 'สร้างข้อมูลสินค้า แล้วรับเข้าเพื่อเพิ่มยอดคงเหลือ' : 'กรอกรายละเอียดเพื่อตรวจสอบย้อนหลังได้'}
                </DialogDescription>
                
                {
                    modal === 'edit' && 
                    <button type="button" className="button" disabled={busy} onClick={() => void reloadEditingProduct()}>
                        โหลดข้อมูลล่าสุด (แทนค่าที่กรอกในฟอร์ม)
                    </button>
                }

                <form key={modal + (editingProduct?.rowVersion ?? '') + editRevision} onSubmit={save} className="entry-form">
                    {
                        isProductForm ? 
                        <>
                            {
                                [['sku', 'รหัสสินค้า'], 
                                ['name', 'ชื่อสินค้า'], 
                                ['category', 'หมวดหมู่'], 
                                ['unit', 'หน่วยนับ'], 
                                ['location', 'ตำแหน่งจัดเก็บ']].map(([n, l]) => 
                                    <label key={n}>{l}
                                        <input name={n} defaultValue={editingProduct ? String(editingProduct[n as keyof Product]) : ""} required maxLength={n === 'name' ? 150 : 60} />
                                    </label>
                                    )
                            }
                            <label>จุดสั่งซื้อขั้นต่ำ
                                <input name="minimum" type="number" min="0" max="1000000000" step="1" defaultValue={editingProduct?.minimum ?? 10} required />
                            </label>
                        </> 
                        : <>
                            <label>สินค้า<Pick label="เลือกสินค้า" value={selected} onChange={setSelected} items={products.map(p => ({ value: String(p.id), label: p.sku + ' · ' + p.name }))} />
                            </label>

                            <div className="balance">
                                คงเหลือ <b>{products.find(p => String(p.id) === selected)?.quantity || 0}</b> {products.find(p => String(p.id) === selected)?.unit}
                            </div>
                            <label>จำนวน
                                <input name="quantity" type="number" min="1" max={modal === 'out' ? products.find(p => String(p.id) === selected)?.quantity : 1000000000} step="1" required />
                            </label>
                            <label>เลขอ้างอิง
                                <input name="reference" placeholder="เช่น PO-2026-001" maxLength={100} />
                            </label>
                            <label>หมายเหตุ
                                <textarea name="note" placeholder="ผู้เบิก / เหตุผล / รายละเอียดเพิ่มเติม" maxLength={500} />
                            </label>
                        </>
                    }
                    <button disabled={busy || loading || !!loadError || (!isProductForm && !products.length)} className="button primary submit">
                        {busy ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    </SidebarProvider>;
}
