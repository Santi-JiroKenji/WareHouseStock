import type { Product, StockTransaction } from '@/types/inventory';

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5080/api').replace(/\/$/, '');

export type CreateProduct = Omit<Product, 'id' | 'quantity' | 'rowVersion'>;
export type CreateStockTransaction = {
  requestId: string;
  productId: number;
  type: 'in' | 'out';
  quantity: number;
  reference: string;
  note: string;
};

export async function request<T>(path: string, body?: unknown, method?: 'PUT'): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) {
        if (!path.startsWith('/auth/')) window.dispatchEvent(new Event('stockflow:unauthorized'));
        throw new ApiError(path === '/auth/login' ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : 'กรุณาเข้าสู่ระบบอีกครั้ง', 401);
      }
      const problem = await response.json().catch(() => null);
      const validation = problem?.errors
        ? Object.values(problem.errors).flat().join(' · ')
        : '';
      throw new Error(validation || problem?.detail || problem?.title || `API error ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('การเชื่อมต่อหมดเวลา หากกดบันทึกแล้วให้ลองอีกครั้งด้วยข้อมูลเดิม เพื่อตรวจสอบรายการเดิม');
    }
    if (error instanceof TypeError) {
      throw new Error('ติดต่อ API ไม่ได้ กรุณาตรวจว่า Backend เปิดอยู่ และ URL กับ CORS ถูกต้อง');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const inventoryApi = {
  product: (id: number) => request<Product>(`/products/${id}`),
  products: () => request<Product[]>('/products'),
  stockTransactions: () => request<StockTransaction[]>('/stockTransactions'),
  createProduct: (input: CreateProduct) => request<Product>('/products', input),
  updateProduct: (id: number, input: CreateProduct & { rowVersion: number }) => request<Product>(`/products/${id}`, input, 'PUT'),
  createStockTransaction: (input: CreateStockTransaction) => request<StockTransaction>('/stockTransactions', input),
};
