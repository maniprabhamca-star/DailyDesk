const API = process.env.NEXT_PUBLIC_API_URL || '';

export type Note = {
  id: string; title: string; content: string; tags: string[];
  createdAt: string; updatedAt: string;
};

export class NotesApiError extends Error {
  code: string; limit?: number;
  constructor(code: string, message: string, limit?: number) { super(message); this.code = code; this.limit = limit; }
}

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null);
export const notesSignedIn = () => !!token();

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API}/api/notes${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(data.error || res.status);
    const message = res.status === 401 ? 'Please sign in to use your notes.' : String(data.message || 'Something went wrong — please try again.');
    throw new NotesApiError(code, message, data.limit);
  }
  return data as T;
}

export const listNotes = () => call<{ notes: Note[]; cap: number | null; count: number }>('');
export const createNote = (n: Pick<Note, 'title' | 'content' | 'tags'>) =>
  call<{ note: Note }>('', { method: 'POST', body: JSON.stringify(n) });
export const updateNote = (id: string, n: Pick<Note, 'title' | 'content' | 'tags'>) =>
  call<{ note: Note }>(`/${id}`, { method: 'PUT', body: JSON.stringify(n) });
export const deleteNote = (id: string) => call<{ ok: true }>(`/${id}`, { method: 'DELETE' });
