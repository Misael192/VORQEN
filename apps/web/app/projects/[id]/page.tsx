import { ChatPanel } from '../../../components/chat/ChatPanel';

/**
 * VORQEN — Rota do workspace de um projeto (Fase 2/3).
 * Server Component mínimo: apenas extrai o params e monta o ChatPanel
 * client-side. Toda a orquestração de IA acontece NO NAVEGADOR (Opção A)
 * — esta página nunca chama o backend para fins de inferência.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-4xl flex-col px-4 py-6">
      <ChatPanel projectId={id} />
    </main>
  );
}
