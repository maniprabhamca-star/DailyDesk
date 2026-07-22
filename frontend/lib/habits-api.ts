const API = process.env.NEXT_PUBLIC_API_URL || '';

export type Habit = {
  id: string; name: string; color: string; frequency: 'daily' | 'weekly';
  createdAt: string; days: string[]; doneToday: boolean; streak: number;
};

export class HabitsApiError extends Error {
  code: string; limit?: number;
  constructor(code: string, message: string, limit?: number) { super(message); this.code = code; this.limit = limit; }
}

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null);
export const habitsSignedIn = () => !!token();

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API}/api/habits${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(data.error || res.status);
    const message = res.status === 401 ? 'Please sign in to track your habits.' : String(data.message || 'Something went wrong.');
    throw new HabitsApiError(code, message, data.limit);
  }
  return data as T;
}

export const listHabits = () => call<{ habits: Habit[]; cap: number | null }>('');
export const createHabit = (name: string, color: string) =>
  call<{ habit: Habit }>('', { method: 'POST', body: JSON.stringify({ name, color }) });
export const toggleHabit = (id: string, date?: string) =>
  call<{ done: boolean }>(`/${id}/toggle`, { method: 'POST', body: JSON.stringify({ date }) });
export const deleteHabit = (id: string) => call<{ ok: true }>(`/${id}`, { method: 'DELETE' });
