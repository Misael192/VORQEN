'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, login, register } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (mode === 'login' && err.status === 401) {
          setError('E-mail ou senha incorretos.');
        } else if (mode === 'register' && err.status === 409) {
          setError('Ja existe uma conta com este e-mail. Faca login.');
        } else if (err.status === 0) {
          setError(err.message);
        } else {
          setError(err.message || 'Nao foi possivel concluir a operacao. Tente novamente.');
        }
      } else {
        setError('Erro inesperado. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111318] px-4 text-[#E8EAF0]">
      <div className="w-full max-w-md rounded-2xl border border-[#343947] bg-[#1B1E26] p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B7CFF] font-black text-[#111318]">
            V
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#A0A6B5]">Platform</p>
            <h1 className="text-2xl font-bold">
              {mode === 'login' ? 'Entrar no VORQEN' : 'Criar conta no VORQEN'}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-[#A0A6B5]">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#343947] bg-[#111318] px-3 py-2 text-sm outline-none transition focus:border-[#8B7CFF]"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-[#A0A6B5]">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#343947] bg-[#111318] px-3 py-2 text-sm outline-none transition focus:border-[#8B7CFF]"
              placeholder={mode === 'register' ? 'Minimo de 8 caracteres' : 'Sua senha'}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[#F16B75]/40 bg-[#F16B75]/10 px-3 py-2 text-sm text-[#F16B75]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-lg bg-[#8B7CFF] px-4 py-2 text-sm font-semibold text-[#111318] transition hover:bg-[#A397FF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? mode === 'login'
                ? 'Entrando...'
                : 'Criando conta...'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#A0A6B5]">
          {mode === 'login' ? 'Nao tem uma conta?' : 'Ja tem uma conta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="font-semibold text-[#8B7CFF] underline-offset-2 hover:underline"
          >
            {mode === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </main>
  );
}
