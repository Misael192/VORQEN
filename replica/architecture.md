# VORQEN: Arquitetura

## Stack

| Tecnologia | Uso | Justificativa |
| --- | --- | --- |
| Next.js 14+ App Router | Aplicação web, renderização e Server Actions. | Mantém UI e operações autenticadas de persistência na mesma aplicação. Não criar Route Handlers para inferência ou proxy de IA. |
| React | Interface interativa do dashboard e workspace. | Composição de telas e estado de chat/editor no cliente. |
| Tailwind CSS + shadcn/ui | Estilos e componentes de interface. | Iteração consistente e acessível sem impor uma camada de runtime. |
| Supabase Auth + PostgreSQL | Identidade e persistência dos dados da plataforma. | Auth gerenciado e banco relacional hospedado; acesso do servidor autenticado e políticas RLS como defesa adicional. |
| Monaco Editor | Edição e inspeção dos arquivos do projeto. | Experiência de edição familiar, realce de sintaxe e modelos de arquivo integráveis. |
| WebContainers (StackBlitz) | Instalação e execução do app gerado no navegador. | Preview interativo sem enviar o workspace para um executor de código no servidor. |
| Ollama local + Vercel AI SDK (`@ai-sdk/ollama`) | Inferência chamada pelo cliente. | Modelo e endpoint são configuráveis localmente; prompt e tokens não passam pela infraestrutura VORQEN. O navegador precisa alcançar a origem do Ollama e o servidor local precisa permitir CORS. |

## Schema PostgreSQL

SQL de referência para Supabase. `auth.users` pertence ao Supabase Auth; `public."User"` é o perfil da aplicação, ligado ao UUID autenticado. Habilitar RLS nas tabelas públicas e restringir leitura/escrita ao proprietário do projeto. Não há tabela de conexão, credencial, URL ou modelo de IA.

```sql
create table public."User" (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."Project" (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public."User" (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_owner_updated_idx
  on public."Project" (owner_id, updated_at desc);

create table public."ProjectFile" (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public."Project" (id) on delete cascade,
  path text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

create table public."ChatMessage" (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public."Project" (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_message_project_created_idx
  on public."ChatMessage" (project_id, created_at);

alter table public."User" enable row level security;
alter table public."Project" enable row level security;
alter table public."ProjectFile" enable row level security;
alter table public."ChatMessage" enable row level security;
```

As políticas de `ProjectFile` e `ChatMessage` devem autorizar operações somente quando o projeto relacionado pertence a `auth.uid()`. As Server Actions também verificam sessão e propriedade em toda operação; a chave `service_role` nunca é exposta ao navegador.

## Server Actions

- `createProject(input)`: valida dados e sessão Supabase; cria projeto para o usuário autenticado.
- `saveProjectFiles(projectId, files)`: valida sessão, propriedade, limites de tamanho e caminhos relativos; faz upsert transacional por `(project_id, path)`.
- `saveChatMessage(projectId, message)`: valida sessão, propriedade, papel e tamanho; persiste uma mensagem por chamada.
- `listProjects()` / `getProject(projectId)`: consulta apenas dados que o usuário pode acessar.

O cliente chama `saveChatMessage` e `saveProjectFiles` após receber e validar a resposta local do Ollama. As Server Actions não recebem configuração do Ollama, prompt de geração para repasse, nem executam inferência. O streaming de IA permanece entre navegador e `localhost:11434`.

## Fronteiras de execução

- O provider Ollama é exclusivamente client-side; receber `baseURL` e modelo a partir das configurações locais, sem ler `localStorage` durante import/SSR.
- Configurar o CORS do Ollama para as origens de desenvolvimento e produção do VORQEN. Falhas devem informar indisponibilidade/CORS sem tentar fallback para o backend.
- Validar o JSON recebido antes de aplicar arquivos e impedir caminhos absolutos, traversal (`..`) ou escrita fora do workspace.
- O WebContainer é uma sandbox no navegador, não uma garantia de isolamento de dados do usuário. Confirmar requisitos de origem segura, headers e suporte do navegador antes do deploy.