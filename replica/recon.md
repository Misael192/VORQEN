# VORQEN: Reconhecimento

## Core Loop

O usuário cria ou abre um projeto, descreve em linguagem natural o que quer construir e recebe alterações de código geradas pelo modelo Ollama em execução na própria máquina. A aplicação exibe os arquivos no Monaco Editor e inicia ou atualiza o projeto no WebContainer para oferecer preview ao vivo. O usuário pode continuar a conversa, inspecionar os arquivos e salvar projeto e histórico no Supabase.

O prompt, o histórico enviado ao modelo e a inferência são processados diretamente entre o navegador e `http://localhost:11434`. O servidor VORQEN não recebe nem encaminha essas requisições. O endereço local e o modelo ficam no `localStorage` do navegador.

## Screens

| ID | Tela | Objetivo | Elementos principais |
| --- | --- | --- | --- |
| S01 | Dashboard | Listar e organizar projetos do usuário autenticado. | Projetos recentes, busca, criar projeto e acesso às configurações. |
| S02 | Configuração de IA (Ollama) | Conectar e validar a instância local do Ollama. | URL base, modelo, teste de conexão e status; persistência somente no `localStorage`. |
| S03 | Chat / Editor | Iterar sobre um projeto usando linguagem natural e código. | Chat com streaming, Monaco Editor, árvore de arquivos e controles de execução. |
| S04 | Preview | Executar e inspecionar a aplicação gerada. | WebContainer, preview ao vivo, estado de inicialização e erros de execução. |

## Flows

### F01: Configurar Ollama e gerar um app

1. O usuário abre S02 e informa a URL local do Ollama e um modelo disponível.
2. O navegador testa a conexão diretamente com o Ollama e salva URL/modelo no `localStorage`. O Ollama deve permitir a origem do VORQEN via configuração CORS (`OLLAMA_ORIGINS`).
3. Em S01, o usuário cria um projeto e entra em S03.
4. O usuário descreve o app no chat. O cliente envia prompt, histórico e modelo diretamente ao Ollama e recebe a resposta em streaming, no formato JSON estrito `{ "files": [{ "path": "src/App.tsx", "content": "..." }] }`.
5. O cliente valida o JSON e os caminhos, atualiza os modelos de arquivo do Monaco e persiste arquivos e mensagem no Supabase por Server Actions independentes da inferência.
6. O WebContainer monta ou atualiza os arquivos, instala dependências quando necessário e executa o projeto.
7. S04 mostra o preview. O usuário pode continuar o fluxo em S03; erros de conexão, parsing e execução são apresentados sem encaminhar dados ao backend de IA.

## Limites de confiança

- Chamadas de geração e teste de conexão: navegador para Ollama local, sem proxy Next.js.
- URL e modelo do Ollama: `localStorage`; não são enviados ou gravados no Supabase.
- Identidade, projetos, arquivos e histórico: Next.js Server Actions autenticadas e Supabase.
- Código executado no WebContainer: conteúdo do projeto; tratar dependências e comandos como entrada não confiável.