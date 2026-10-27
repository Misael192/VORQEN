export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  hasFiles?: boolean;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectDetail extends ProjectSummary {
  files: ProjectFile[];
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'vorqen_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  if (auth) {
    const token = getToken();
    if (!token) {
      throw new ApiError(401, 'Sessao invalida ou expirada. Faca login novamente.');
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Nao foi possivel conectar a API do VORQEN. Verifique se o backend esta em execucao.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // corpo vazio ou nao-JSON
  }

  if (!response.ok) {
    const body = payload as { message?: string | string[] } | null;
    const raw = body?.message;
    const message = Array.isArray(raw) ? raw.join(' ') : raw;
    if (response.status === 401) {
      clearToken();
    }
    throw new ApiError(response.status, message || 'Erro inesperado na comunicacao com a API.');
  }

  return payload as T;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser; token: string }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
  setToken(data.token);
  return data.user;
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser; token: string }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
  setToken(data.token);
  return data.user;
}

export async function getProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>('/projects');
}

export async function createProject(name: string): Promise<ProjectSummary> {
  return request<ProjectSummary>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function getProject(id: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${id}`);
}

export async function saveProjectFiles(
  projectId: string,
  files: ProjectFile[],
): Promise<{ ok: boolean; versionId: string; savedAt: string; fileCount: number }> {
  return request(`/projects/${projectId}/files`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  });
}
