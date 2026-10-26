'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, setToken } from '../../src/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = mode === 'login' ? await login(email, password) : await register(email, password);
      // Fase 5: token JWT salvo no localStorage e enviado como Bearer pelo api-client.
      setToken(result.accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-8"
      >
        <h1 className="text-2xl font-bold">
          VORQEN <span className="text-brand-300">{mode === 'login' ? 'Entrar' : 'Criar conta'}</span>
        </h1>

        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          type="password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          placeholder="Senha (mín. 8 caracteres no cadastro)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:underline"
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </main>
  );
}
