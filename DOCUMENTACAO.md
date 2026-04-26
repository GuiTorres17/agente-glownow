# Documentação do Projeto: Agente Lino Esmalteria 💅

Este documento detalha tudo o que foi desenvolvido até o momento para o assistente virtual (Agente IA) da Lino Esmalteria, incluindo arquitetura, fluxos conversacionais, integração com banco de dados, stack do frontend e backend, processos de deploy, e o painel administrativo secreto.

---

## 1. Arquitetura Geral do Sistema

O projeto adota uma arquitetura cliente-servidor moderna, separando claramente o frontend da interface de usuário e o backend que processa a lógica de negócio e as integrações de Inteligência Artificial.

*   **Frontend**: Desenvolvido em React com Vite e TypeScript, estilizado com Tailwind CSS e componentes da biblioteca Shadcn UI. Focado em oferecer uma interface de chat fluida, responsiva e moderna.
*   **Backend**: Desenvolvido em Python utilizando o framework FastAPI. Responsável por gerenciar os endpoints de comunicação (`/chat`, `/servicos`, `/manicures`), controlar o estado da conversa e se comunicar com o banco de dados e a IA.
*   **Banco de Dados**: Utilizamos o **Supabase** (PostgreSQL) para armazenamento de dados persistentes. O banco guarda informações cruciais como `clientes`, `agendamentos`, `servicos` e `manicures`.
*   **Inteligência Artificial**: O núcleo conversacional utiliza a API do **Google Gemini 1.5 Flash**. A IA foi customizada através de *System Prompts* estritos para ser simpática, atenciosa e não alucinar com preços ou informações incorretas.

---

## 2. Fluxos e Inteligência do Agente (Backend)

O agente conversacional foi projetado para atuar como um sistema híbrido: ele combina a **conversa natural do Gemini** com um **motor de estado rigoroso (State Machine)** para fluxos que exigem exatidão e gravação em banco de dados. 

### 2.1. Inteligência e Humanização
*   **Tom de Voz**: A assistente (Lina) possui um tom de voz acolhedor, profissional e prestativo, humanizando a experiência e evitando que pareça "robótica".
*   **Fuzzy Logic e Reconhecimento Flexível**: Implementamos um sistema de `fuzzy match` (correspondência aproximada). Isso permite que o bot reconheça intenções e escolhas de serviços/profissionais mesmo que o cliente cometa erros de digitação (ex: "manicuri", "pés", "gelzinho").
*   **Escape Universal**: A qualquer momento, se o usuário digitar "cancelar", "sair" ou "voltar", o fluxo atual (seja de agendamento ou cadastro) é interrompido de forma limpa, retornando o usuário ao menu principal.

### 2.2. Fluxo de Cadastro de Cliente
O processo original de login por CPF foi substituído por um fluxo moderno e amigável:
1.  **Solicitação de Contato**: O sistema tenta identificar o cliente pelo E-mail ou Celular.
2.  **Registro Guiado**: Se o cliente não existe, o robô inicia o fluxo de cadastro perguntando Nome -> Email -> Celular (opcional).
3.  **Confirmação e Gravação**: Após confirmar os dados, o usuário é gravado na tabela `clientes` do Supabase e o login é feito automaticamente.

### 2.3. Fluxo de Agendamento e Pagamento (PIX)
Um dos fluxos mais completos é o de agendamento de horários:
1.  **Data e Serviço**: O usuário escolhe o dia e o serviço desejado.
2.  **Profissional e Horário**: Seleciona com qual manicure deseja fazer o serviço e o horário disponível.
3.  **Sinal e PIX Copia-e-Cola**: Antes de finalizar, o sistema calcula **40% do valor do serviço** como sinal (pré-pagamento obrigatório). O bot gera e exibe um código PIX Copia e Cola simulado.
4.  **Validação de Pagamento**: O bot aguarda o usuário digitar "pago" (ou similar) para então gravar o agendamento como *Confirmado* no banco de dados.

---

## 3. Frontend (Interface do Usuário)

O Frontend foi completamente reestruturado para ser um projeto Vite/React padrão de mercado.

*   **Páginas Principais**: A página `Index.tsx` abriga a interface principal do chat. Ela se comunica ativamente com a API do FastAPI via requisições HTTP (POST).
*   **Componentes de UI**: Adotamos bibliotecas robustas de acessibilidade e design (`@radix-ui`) empacotadas via Shadcn UI, garantindo uma estética *premium*, rápida e minimalista, sem sacrificar a funcionalidade. Ícones dinâmicos utilizam a biblioteca **Lucide React**.
*   **Gerenciamento de Estado do Chat**: As mensagens e o histórico do chat em tempo real são gerenciados localmente no React, exibindo indicadores de digitação (typing) quando o backend está processando uma resposta.

---

## 4. Painel Administrativo Secreto

Para garantir segurança e separar a interface do cliente da interface de gestão dos funcionários, foi implementado um **Painel Administrativo protegido e invisível** para o público em geral.

### 4.1. Gatilho Secreto (Easter Egg)
O painel não possui botões públicos. Para acessá-lo, o funcionário deve digitar a frase secreta **"Hipopotamo quadrado robinilson de pernil"** diretamente no chat. O frontend intercepta essa mensagem e redireciona silenciosamente para a rota de login (`/admin/login`).

### 4.2. Autenticação e Segurança
*   **Login**: Protegido por usuário e senha (`esmalteria123` / `esmalteria@123`).
*   **Tokens (JWT-like)**: O backend (FastAPI) gera um token seguro (`secrets.token_hex`) com expiração de 8 horas. Esse token é armazenado no `localStorage` e exigido em todas as requisições de dashboard.
*   **Restrição no Chat Público**: Intenções de admin (ex: "ver agenda", "relatório") foram bloqueadas no agente público. Clientes não podem acessar dados administrativos via IA.

### 4.3. Dashboard Visual e Funcionalidades
O painel foi construído em React com um visual *dark premium* (glassmorphism via Tailwind CSS) e é dividido em duas visões principais usando **React Router**:
*   **Visão Diária**:
    *   Exibe KPIs em tempo real (Faturamento Previsto, Confirmados, Pendentes, Total de Clientes).
    *   Lista detalhada e cronológica de todos os agendamentos do dia selecionado.
    *   Navegação fácil entre dias anteriores e posteriores utilizando setas ou botão "Hoje".
    *   Botões de "Ação Rápida" para confirmar manualmente o recebimento de sinal/PIX de clientes pendentes.
*   **Visão Mensal (Calendário)**:
    *   Um calendário completo em formato de grid renderizando os dados agregados do mês inteiro.
    *   Cada dia do mês exibe uma "mini-visão" mostrando o total de agendamentos e o faturamento previsto.
    *   Indicadores visuais de status (verde se todos estão pagos, âmbar se existem pendências).
    *   Totalização dos KPIs do mês corrente no topo.

---

## 5. Integrações Externas e Tecnologias Usadas

### 5.1. Ferramentas e Bibliotecas Utilizadas (Full Stack)

**Frontend (React/Vite ecosystem):**
*   **React (v18)** + **TypeScript**: Base estrutural garantindo tipagem forte e componentização.
*   **Vite**: Bundler ultra-rápido para desenvolvimento e build.
*   **Tailwind CSS** + **Tailwind Merge** (`tailwind-merge`) + **clsx**: Construção de classes utilitárias condicionais para estilização fluida, permitindo o design *glassmorphism*.
*   **React Router DOM**: Gestão de rotas client-side, permitindo a separação entre o chat (`/`) e as páginas protegidas de admin (`/admin/login`, `/admin`).
*   **Lucide React**: Biblioteca de ícones vetorizados escaláveis e leves.
*   **Shadcn UI** + **Radix UI**: Componentes acessíveis como toasts (`sonner`, `toaster`) e tooltips, sem lock-in de estilização.
*   **React Query** (`@tanstack/react-query`): Configurado no `App.tsx` para gerenciamento avançado de estado e requisições no lado do cliente.
*   **qrcode.react**: Utilizado para renderizar QRCode (ex: fluxo de pagamento PIX fictício).
*   **date-fns**: Formatação leve e manipulação de datas no Frontend.

**Backend (Python ecosystem):**
*   **FastAPI**: Framework web moderno e de alta performance para a criação dos endpoints e lógica do agente.
*   **Uvicorn**: Servidor ASGI leve usado para rodar a aplicação FastAPI.
*   **Supabase (Python SDK)**: ORM e driver de conexão para interagir com o PostgreSQL armazenado na nuvem.
*   **Google GenAI SDK** (`google-genai`): Interface de comunicação direta com o LLM Gemini 1.5 Flash.
*   **Pydantic**: Usado embutido no FastAPI para tipagem e validação de payloads JSON estritos na API.
*   **Fuzzbook** / `fuzzywuzzy` / Algoritmos de Fuzzy Match: Usados na "inteligência" determinística do agente para identificar aproximações textuais dos nomes dos serviços e manicures.
*   **Python-dotenv**: Gerenciamento seguro das credenciais via arquivo `.env`.

### 5.2. Serviços de Backend e Nuvem
*   **Supabase**: Banco de dados PostgreSQL escalável integrado nativamente. Usado via MCP Servers e cliente Python.
*   **Google Gemini API (1.5 Flash)**: O "cérebro" do assistente, garantindo respostas rápidas, precisas e humanizadas, com baixo risco de alucinação e altíssima compreensão de contexto (fuzzy logic natural).

---

## 6. Processo de Deploy (Produção)

A aplicação está estruturada para ambientes *cloud-ready* com integração contínua (CI/CD):

*   **Repositório (GitHub)**: Hospedagem do código-fonte.
*   **Backend no Render (Web Service)**: 
    *   A API FastAPI é deployada automaticamente. Configurada via `requirements.txt`. Variáveis de ambiente sensíveis (Supabase e Gemini) seguras no painel do Render.
*   **Frontend na Vercel**: 
    *   A interface React é construída (`npm run build`) via Vercel. 
    *   **SPA Routing**: Implementamos um `vercel.json` (`rewrites` para `/index.html`) para garantir que as rotas secretas do React Router (`/admin/login`) não retornem erro 404 ao serem acessadas diretamente.
    *   O frontend consome a URL de produção do Render via `VITE_AGENT_URL`.
