/**
 * Cliente HTTP da API VORQEN (apps/api).
 * Nenhuma chamada de IA passa por aqui — a inferência é 100% client-side via @vorqen/ai-core.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'vorqen_token';

export interface AuthUser {
  id: string;
  email: string;
}

export interface ProjectFileDto {
  path: string;
  content: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description?: string | null;
  files?: ProjectFileDto[];
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  // Fase 5: o usuário vem do JWT (Authorization header) — sem mais temp-user-id.
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 401 && typeof window !== 'undefined') {
    clearToken();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Erro ${response.status} ao chamar a API.`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export async function register(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function createProject(name: string, description?: string): Promise<ProjectDto> {
  return request<ProjectDto>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function listProjects(): Promise<ProjectDto[]> {
  return request<ProjectDto[]>('/api/v1/projects');
}

export async function getProject(projectId: string): Promise<ProjectDto & { files: ProjectFileDto[] }> {
  return request(`/api/v1/projects/${projectId}`);
}

/** Chamada pelo botão "Salvar" do IDEWorkspace: persiste os arquivos do projeto na API. */
export async function saveProjectFiles(
  projectId: string,
  files: ProjectFileDto[],
): Promise<ProjectFileDto[]> {
  return request(`/api/v1/projects/${projectId}/files`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  });
}

export async function saveChatMessage(
  projectId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
): Promise<void> {
  await request(`/api/v1/projects/${projectId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role, content }),
  });
}
