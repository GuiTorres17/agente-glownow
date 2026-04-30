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

### 2.4. Aviso de Consentimento (LGPD)
Na primeira mensagem de boas-vindas ao usuário, o agente exibe um aviso de consentimento sutil:
> _"Ao continuar conversando comigo para realizar seu agendamento, você concorda com os nossos termos de uso de dados."_

Este aviso está presente tanto no **backend** (resposta da saudação no `agente.py`) quanto no **frontend** (mensagem inicial estática no `Index.tsx`), garantindo que o usuário sempre veja o aviso independentemente de como a conversa começou. O texto é renderizado em formato _itálico_ com tamanho e cor sutis para não poluir a interface.

---

## 3. Tabela de Serviços e Preços (Atualizado em 30/04/2026)

A tabela de serviços foi completamente atualizada para refletir o catálogo oficial da **Maisa Lino Esmalteria**. Os serviços estão organizados em **6 categorias**:

### 3.1. Manicure e Pedicure
| Serviço | Preço |
|---|---|
| Manicure | R$ 30,00 |
| Pedicure | R$ 30,00 |
| Manicure & Pedicure | R$ 55,00 |
| Francesinha | R$ 5,00 |
| Spa dos pés simples | R$ 30,00 |
| Spa dos pés completo | R$ 45,00 |

### 3.2. Esmaltação em Gel & Banho de Gel
*Camada de gel nas unhas naturais formando uma película protetora para evitar quebras. Inclui cutilagem.*

| Serviço | Preço |
|---|---|
| Banho de gel + esmaltação comum | R$ 90,00 |
| Banho de gel + esmaltação em gel | R$ 100,00 |
| Banho de gel + decoração simples | R$ 110,00 |
| Banho de gel + decoração encapsulada | R$ 115,00 |
| Esmaltação em Gel \| mãos | R$ 25,00 |
| Esmaltação em Gel \| pés | R$ 25,00 |
| Reconstrução unha do pé (por unha) | R$ 20,00 |

### 3.3. Alongamento na Fibra de Vidro
*Alongamento nos formatos Almond, Bailarina e Quadrado.*

| Serviço | Preço |
|---|---|
| Aplicação de fibra de vidro | R$ 160,00 |
| Aplicação de fibra de vidro + esmaltação em gel | R$ 170,00 |

### 3.4. Outras Decorações
*Outras opções que temos no estúdio para diferenciar o seu alongamento.*

| Serviço | Preço |
|---|---|
| Baby Boomer | R$ 15,00 |
| Decoração básica | R$ 15,00 |
| Par de unha encapsulada | R$ 15,00 |
| Todas unhas encapsulada | R$ 35,00 |

### 3.5. Serviços à Parte
*Serviços à parte feitos dentro e fora do dia da manutenção.*

| Serviço | Preço |
|---|---|
| Reposição de unha | R$ 15,00 |
| Reparo lateral | R$ 5,00 |
| Remoção de alongamento | R$ 35,00 |
| Remoção + nova aplicação | R$ 190,00 |

### 3.6. Manutenção
*Recomendamos no máximo de 30 dias para o retorno.*

| Serviço | Preço |
|---|---|
| Manutenção esmaltação comum | R$ 90,00 |
| Manutenção esmaltação em gel | R$ 100,00 |
| Manutenção de outro profissional | R$ 110,00 |
| Manutenção com mais de 30 dias | R$ 120,00 |

---

## 4. Frontend (Interface do Usuário)

O Frontend foi completamente reestruturado para ser um projeto Vite/React padrão de mercado.

*   **Páginas Principais**: A página `Index.tsx` abriga a interface principal do chat. Ela se comunica ativamente com a API do FastAPI via requisições HTTP (POST).
*   **Componentes de UI**: Adotamos bibliotecas robustas de acessibilidade e design (`@radix-ui`) empacotadas via Shadcn UI, garantindo uma estética *premium*, rápida e minimalista, sem sacrificar a funcionalidade. Ícones dinâmicos utilizam a biblioteca **Lucide React**.
*   **Gerenciamento de Estado do Chat**: As mensagens e o histórico do chat em tempo real são gerenciados localmente no React, exibindo indicadores de digitação (typing) quando o backend está processando uma resposta.
*   **Renderização de Markdown no Chat**: O componente `renderMessageContent` suporta:
    *   **Negrito** (`**texto**`) — renderizado como `<strong>`
    *   **Itálico** (`_texto_`) — renderizado como `<em>` com estilo sutil (cinza, 11px), usado para o aviso de consentimento LGPD
    *   **PIX QR Code** (`{{PIX:código}}`) — renderizado como bloco visual com QR Code e botão de copiar

---

## 5. Painel Administrativo Secreto

Para garantir segurança e separar a interface do cliente da interface de gestão dos funcionários, foi implementado um **Painel Administrativo protegido e invisível** para o público em geral.

### 5.1. Gatilho Secreto (Easter Egg)
O painel não possui botões públicos. Para acessá-lo, o funcionário deve digitar a frase secreta **"acesso administrativo lino esmalteria"** diretamente no chat. O frontend intercepta essa mensagem e redireciona silenciosamente para a rota de login (`/admin/login`).

### 5.2. Autenticação e Segurança
*   **Login**: Protegido por usuário e senha (`esmalteria123` / `esmalteria@123`).
*   **Tokens (JWT-like)**: O backend (FastAPI) gera um token seguro (`secrets.token_hex`) com expiração de 8 horas. Esse token é armazenado no `localStorage` e exigido em todas as requisições de dashboard.
*   **Restrição no Chat Público**: Intenções de admin (ex: "ver agenda", "relatório") foram bloqueadas no agente público. Clientes não podem acessar dados administrativos via IA.

### 5.3. Dashboard Visual e Funcionalidades
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

## 6. Integrações Externas e Tecnologias Usadas

### 6.1. Ferramentas e Bibliotecas Utilizadas (Full Stack)

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

### 6.2. Serviços de Backend e Nuvem
*   **Supabase**: Banco de dados PostgreSQL escalável integrado nativamente. Usado via MCP Servers e cliente Python.
*   **Google Gemini API (1.5 Flash)**: O "cérebro" do assistente, garantindo respostas rápidas, precisas e humanizadas, com baixo risco de alucinação e altíssima compreensão de contexto (fuzzy logic natural).

---

## 7. Processo de Deploy (Produção)

A aplicação está estruturada para ambientes *cloud-ready* com integração contínua (CI/CD):

*   **Repositório (GitHub)**: Hospedagem do código-fonte.
*   **Backend no Render (Web Service)**: 
    *   A API FastAPI é deployada automaticamente. Configurada via `requirements.txt`. Variáveis de ambiente sensíveis (Supabase e Gemini) seguras no painel do Render.
*   **Frontend na Vercel**: 
    *   A interface React é construída (`npm run build`) via Vercel. 
    *   **SPA Routing**: Implementamos um `vercel.json` (`rewrites` para `/index.html`) para garantir que as rotas secretas do React Router (`/admin/login`) não retornem erro 404 ao serem acessadas diretamente.
    *   O frontend consome a URL de produção do Render via `VITE_AGENT_URL`.

---

## 8. Histórico de Atualizações

### 30/04/2026 — Atualização da Tabela de Preços e Consentimento LGPD
**Resumo**: Atualização completa do catálogo de serviços para refletir a tabela oficial da Maisa Lino Esmalteria e adição de aviso de consentimento de dados.

**Alterações realizadas:**

1.  **Atualização da tabela de serviços (27 serviços em 6 categorias)**
    *   Os 8 serviços antigos (Manicure R$30, Pedicure R$40, Esmaltação em Gel R$60, Alongamento R$120, Fibra de Vidro R$110, Spa dos Pés R$65, Francesinha R$45, Decoração R$15) foram **desativados** no Supabase e substituídos por 27 novos serviços organizados nas categorias: Manicure e Pedicure, Esmaltação em Gel & Banho de Gel, Alongamento na Fibra de Vidro, Outras Decorações, Serviços à Parte, e Manutenção.
    *   Os preços agora variam de R$ 5,00 (Francesinha, Reparo lateral) até R$ 190,00 (Remoção + nova aplicação).

2.  **Aviso de Consentimento LGPD**
    *   Adicionado aviso sutil na primeira mensagem de boas-vindas: *"Ao continuar conversando comigo para realizar seu agendamento, você concorda com os nossos termos de uso de dados."*
    *   Implementado tanto no backend (`agente.py`) quanto no frontend (`Index.tsx`).
    *   O frontend renderiza o aviso em texto itálico cinza claro (11px) para ser visível mas não intrusivo.

3.  **Exibição de serviços agrupada por categoria**
    *   O método `_mostrar_servicos()` foi refatorado para agrupar e exibir os serviços por categoria, tornando a lista organizada e legível mesmo com 27 itens.

4.  **Atualização de apelidos e fuzzy match**
    *   O dicionário `APELIDOS_SERVICO` foi expandido significativamente para cobrir todos os novos nomes de serviço com apelidos coloquiais (ex: "fibra gel" → fibra de vidro + gel, "boomer" → baby boomer, "combo" → manicure & pedicure).

5.  **Renderização de itálico no frontend**
    *   O componente `renderMessageContent` agora suporta markdown itálico (`_texto_`) além do negrito (`**texto**`) e blocos PIX.

6.  **Banco de dados sincronizado**
    *   `Banco_PI.sql` atualizado com `INSERT` completo dos 27 novos serviços.
    *   Supabase em produção atualizado (serviços antigos desativados, novos serviços inseridos com `ativo = TRUE`).

7.  **Deploy em produção**
    *   Commit `9572bfe` enviado ao GitHub → auto-deploy no **Render** (backend) e **Vercel** (frontend).

**Arquivos modificados:**
*   `agente.py` — Novos serviços, categorias, apelidos, aviso LGPD, exibição agrupada
*   `src/pages/Index.tsx` — Aviso LGPD na mensagem inicial, renderização de itálico
*   `Banco_PI.sql` — Script SQL completo atualizado com 27 serviços
*   `DOCUMENTACAO.md` — Documentação atualizada com todo o histórico

---

### 30/04/2026 (2ª atualização) — Melhorias no Banco, Renderização e Fluxos
**Resumo**: Correção de 5 problemas reportados: schema do banco melhorado, frase secreta profissional, fix na confirmação de sinal do admin, renderização de negrito, e retry no login.

**Alterações realizadas:**

1.  **Melhorias no Banco de Dados (Schema)**
    *   Adicionada coluna `preco_cobrado` na tabela `agendamentos` — armazena o preço do serviço **no momento do agendamento**, garantindo rastreabilidade mesmo se os preços mudarem no futuro.
    *   Adicionada coluna `valor_sinal` — armazena o valor esperado do sinal (40% do preço).
    *   Adicionada coluna `forma_pagamento` — registra o meio de pagamento (default: 'pix').
    *   Criada tabela `funcionarios` — preparada para autenticação profissional do painel admin (id, nome, usuario, senha_hash, cargo, ativo).
    *   Migration aplicada no Supabase e backfill dos dados existentes concluído.

2.  **Frase Secreta Profissional**
    *   A frase secreta para acessar o painel administrativo foi alterada de `"Hipopotamo quadrado robinilson de pernil"` para `"acesso administrativo lino esmalteria"`.
    *   Profissional, discreta e impossível de ser digitada acidentalmente por um cliente.

3.  **Correção da Confirmação de Sinal no Admin**
    *   O erro ocorria porque o endpoint `/admin/confirmar-sinal` tentava buscar o preço via `servicos(preco)` FK join, mas serviços desativados retornavam `null`.
    *   Agora o endpoint usa `preco_cobrado` da tabela `agendamentos` como fonte primária, com fallback para o join com `servicos`.
    *   A mesma lógica foi aplicada no `_obter_agendamentos_do_dia()` do agent backend.

4.  **Correção do Negrito no Frontend**
    *   O agente usava `*texto*` (formato WhatsApp) mas o frontend só renderizava `**texto**` (formato Markdown).
    *   **Todas** as mensagens do agente foram padronizadas para usar `**texto**` (double asterisk).
    *   Mensagens afetadas: login, cadastro, agendamento (data, serviço, profissional, resumo, confirmação), relatório admin.

5.  **Login com Retry**
    *   Antes: se o login falhava, o fluxo era encerrado e o usuário precisava digitar "login" novamente.
    *   Agora: o fluxo permanece ativo (`login_contato`), permitindo que o usuário tente outro e-mail ou celular imediatamente.
    *   Se o usuário digitar "cadastrar" durante o login, é redirecionado automaticamente para o fluxo de cadastro sem precisar cancelar.

**Arquivos modificados:**
*   `agente.py` — Bold `**text**`, login retry, `preco_cobrado`, cadastro redirect no login
*   `api.py` — Fix `/admin/confirmar-sinal` com fallback `preco_cobrado`
*   `src/pages/Index.tsx` — Nova frase secreta profissional
*   `Banco_PI.sql` — Novas colunas (`preco_cobrado`, `valor_sinal`, `forma_pagamento`) + tabela `funcionarios`
*   `DOCUMENTACAO.md` — Documentação atualizada

---

### 30/04/2026 (3ª atualização) — Segurança, Governança e Refatoração Completa
**Resumo**: Refatoração do banco de dados, implementação de RBAC/RLS, criptografia de dados sensíveis com pgcrypto, sistema de auditoria com triggers, e correção de 4 bugs críticos.

**Alterações realizadas:**

#### PARTE 1 — Correção de Bugs e Refatoração

1.  **Tabela `conversas` → `historico_conversas`**
    *   **Problema**: A tabela `conversas` existia no banco mas **nunca era utilizada** — o histórico era salvo apenas em memória (dict Python), perdido a cada restart do servidor.
    *   **Fix**: DROP da tabela antiga + criação de `historico_conversas` com schema adequado (`sessao_id`, `cliente_id`, `mensagem_usuario`, `resposta_agente`, `intencao_detectada`, `criado_em`).
    *   O método `AssistenteIA.adicionar_ao_historico()` agora persiste cada troca de mensagem no Supabase em tempo real.

2.  **DROP de tabelas redundantes**
    *   Tabela `funcionarios`: criada na migration anterior mas **nunca utilizada** (auth é hardcoded na API). Sem FKs dependentes → DROP seguro.
    *   Tabela `estoque`: nunca populada, sem queries referenciando. Sem FKs dependentes → DROP seguro.
    *   Referência `self.funcionario` removida da classe `SessaoCliente`.

3.  **Fix do botão "Confirmar Sinal" no painel admin**
    *   **Causa raiz**: Agendamentos legados tinham `preco_cobrado = 0` e `sinal_pago = 0` com `status = 'confirmado'`, criando inconsistência onde o frontend mostrava "Aguardando" mas o backend já marcava como confirmado.
    *   **Fix**: Nova coluna `sinal_confirmado BOOLEAN` distingue entre "agendamento criado pelo chat" e "sinal verificado pelo admin".
    *   O endpoint `/admin/confirmar-sinal` agora seta `sinal_confirmado = TRUE`, e o frontend usa esse flag para renderizar o badge verde.
    *   Adicionado feedback visual (toast verde) no sucesso e mensagem de erro detalhada na falha.
    *   Backfill aplicado: agendamentos com `sinal_pago > 0` receberam `sinal_confirmado = TRUE`, e os com `preco_cobrado = 0` foram corrigidos.

4.  **UX do bot — Texto e fluxo de identificação**
    *   Frase alterada: `"Se sim, me fala login"` → `"Se sim, faça login"` (mais direto e natural).
    *   Novo estado `aguardando_identificacao`: Após a mensagem de boas-vindas, o sistema aguarda ativamente a resposta do usuário e roteia automaticamente:
        - "sim", "já", "tenho" → inicia login
        - "não", "nova", "primeira vez" → inicia cadastro
        - "login", "cadastrar", "serviços", "agendar" → ação correspondente
    *   Frontend (Index.tsx) atualizado com o novo texto.

---

## 9. Segurança e Governança (Implementado em 30/04/2026)

### 9.1. Controle de Acesso — RBAC + RLS

O sistema implementa **Role-Based Access Control** (RBAC) combinado com **Row Level Security** (RLS) do Supabase/PostgreSQL.

**Roles definidos:**
| Role | Escopo | Tabelas |
|---|---|---|
| `admin` | Acesso total a todas as tabelas e operações | agendamentos, clientes, servicos, manicures, audit_logs |
| `manicure` | Leitura dos próprios agendamentos e dados limitados | agendamentos (filtrado), servicos (read), clientes (read) |
| `anon` | Acesso público mínimo via API | servicos (read), manicures (read), clientes (insert), historico_conversas (insert) |

**Coluna `role` na tabela `manicures`**: Cada manicure possui um campo `role` com constraint `CHECK (role IN ('admin', 'manicure'))`. A primeira manicure cadastrada é automaticamente definida como `admin`.

**Políticas RLS aplicadas:**
*   `agendamentos`: SELECT/INSERT/UPDATE para `anon` e `authenticated`; DELETE somente `authenticated`
*   `clientes`: SELECT/INSERT/UPDATE para `anon` e `authenticated`
*   `servicos`: SELECT para todos; gerenciamento completo para `authenticated`
*   `manicures`: SELECT para todos; gerenciamento completo para `authenticated`
*   `historico_conversas`: INSERT para todos; SELECT para `anon` e `authenticated`
*   `audit_logs`: SELECT para `authenticated`; INSERT para todos (via triggers)

### 9.2. Criptografia — Data at Rest com pgcrypto

A extensão **pgcrypto** (v1.3) foi configurada para criptografia simétrica dos dados sensíveis dos clientes.

**Implementação:**
*   Coluna `celular_encrypted` (BYTEA) na tabela `clientes`
*   Criptografia via `pgp_sym_encrypt()` com chave simétrica centralizada em `get_encryption_key()`
*   Descriptografia via `pgp_sym_decrypt()` pela view `vw_clientes_decrypted`
*   Funções RPC seguras (`SECURITY DEFINER`):
    *   `encrypt_celular(phone TEXT)` → BYTEA criptografado
    *   `decrypt_celular(encrypted_phone BYTEA)` → TEXT descriptografado
    *   `get_encryption_key()` → centraliza a chave (facilita rotação futura)
*   Todos os celulares existentes foram criptografados durante a migration
*   Novos cadastros criptografam automaticamente via RPC

### 9.3. Auditoria — Rastreabilidade com Triggers

Sistema de auditoria automática via triggers PostgreSQL.

**Tabela `audit_logs`:**
| Coluna | Tipo | Descrição |
|---|---|---|
| `tabela_afetada` | VARCHAR | Nome da tabela (ex: `agendamentos`) |
| `acao` | VARCHAR | `INSERT`, `UPDATE` ou `DELETE` |
| `registro_id` | INTEGER | ID do registro afetado |
| `dados_antigos` | JSONB | Snapshot antes da operação (NULL em INSERT) |
| `dados_novos` | JSONB | Snapshot após a operação (NULL em DELETE) |
| `executado_por` | VARCHAR | Quem executou (default: `system`) |
| `criado_em` | TIMESTAMP | Data/hora da operação |

**Triggers ativos:**
*   `trg_audit_agendamentos` → INSERT, UPDATE, DELETE em `agendamentos`
*   `trg_audit_clientes` → INSERT, UPDATE em `clientes`

**Função genérica `fn_audit_trigger()`**: PL/pgSQL `SECURITY DEFINER` reutilizável em qualquer tabela.

### 9.4. Schema Atual do Banco (v3.0)

| Tabela | Status | Descrição |
|---|---|---|
| `clientes` | ✅ Ativa | Dados dos clientes com celular criptografado |
| `manicures` | ✅ Ativa | Profissionais com campo `role` (RBAC) |
| `servicos` | ✅ Ativa | Catálogo de 27 serviços em 6 categorias |
| `agendamentos` | ✅ Ativa | Com `preco_cobrado`, `valor_sinal`, `sinal_confirmado` |
| `historico_conversas` | ✅ Nova | Histórico persistente de mensagens |
| `audit_logs` | ✅ Nova | Logs de auditoria automáticos |
| `funcionarios` | ❌ Removida | Substituída por `manicures.role` |
| `estoque` | ❌ Removida | Fora de escopo |
| `conversas` | ❌ Removida | Substituída por `historico_conversas` |

**Arquivos modificados (3ª atualização):**
*   `agente.py` — Persistência do histórico, `aguardando_identificacao`, UX text, criptografia, `sinal_confirmado`
*   `api.py` — Endpoint `/admin/confirmar-sinal` reescrito com `sinal_confirmado` + log
*   `src/pages/Index.tsx` — Texto "faça login", frontend sincronizado
*   `src/pages/AdminPanel.tsx` — `sinal_confirmado` flag, toast de sucesso, feedback visual
*   `Banco_PI.sql` — Schema v3.0 completo (6 tabelas, triggers, funções, view)
*   `DOCUMENTACAO.md` — Documentação completa com arquitetura de segurança

