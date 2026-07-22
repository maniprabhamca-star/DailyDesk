const API = process.env.NEXT_PUBLIC_API_URL || '';

export type Expense = {
  id: string; amount: number; category: string; description: string; merchant: string; date: string;
};
export type BudgetMonth = {
  month: string; expenses: Expense[]; total: number;
  byCategory: Record<string, number>; count: number; cap: number | null;
};

export const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Fun', 'Home', 'Other'] as const;

export class BudgetApiError extends Error {
  code: string; limit?: number;
  constructor(code: string, message: string, limit?: number) { super(message); this.code = code; this.limit = limit; }
}

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null);
export const budgetSignedIn = () => !!token();

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API}/api/budget${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(data.error || res.status);
    const message = res.status === 401 ? 'Please sign in to track your budget.' : String(data.message || 'Something went wrong.');
    throw new BudgetApiError(code, message, data.limit);
  }
  return data as T;
}

export const getMonth = (month: string) => call<BudgetMonth>(`?month=${encodeURIComponent(month)}`);
export const addExpense = (e: Pick<Expense, 'amount' | 'category' | 'description' | 'merchant' | 'date'>) =>
  call<{ expense: Expense }>('', { method: 'POST', body: JSON.stringify(e) });
export const deleteExpense = (id: string) => call<{ ok: true }>(`/${id}`, { method: 'DELETE' });
