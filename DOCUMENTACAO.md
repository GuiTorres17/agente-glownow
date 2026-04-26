# Documentação do Projeto: Agente Lino Esmalteria 💅

Este documento detalha tudo o que foi desenvolvido até o momento para o assistente virtual (Agente IA) da Lino Esmalteria, incluindo arquitetura, fluxos conversacionais, integração com banco de dados, stack do frontend e backend, e os processos de deploy.

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
*   **Componentes de UI**: Adotamos bibliotecas robustas de acessibilidade e design (`@radix-ui`) empacotadas via Shadcn UI, garantindo uma estética *premium*, rápida e minimalista, sem sacrificar a funcionalidade.
*   **Gerenciamento de Estado do Chat**: As mensagens e o histórico do chat em tempo real são gerenciados localmente no React, exibindo indicadores de digitação (typing) quando o backend está processando uma resposta.

---

## 4. Integrações Externas

### 4.1. Supabase
Totalmente integrado via variáveis de ambiente (`SUPABASE_URL` e `SUPABASE_KEY`). O uso do cliente em Python garante buscas, inserções e validações na nuvem. Foram configurados *MCP Servers* para melhorar a gestão de dados.

### 4.2. Google Gemini API
A transição do modelo antigo (DialoGPT local, pesado e com muitas alucinações) para o **Google GenAI** modernizou o bot. Ele agora consome pouco recurso local/servidor, respondendo de forma ultra-rápida e contextualizada às regras da esmalteria.

---

## 5. Processo de Deploy (Produção)

A aplicação foi migrada de um ambiente unicamente local para uma estrutura *cloud-ready* funcional, disponível na web:

*   **Repositório e CI/CD**: O projeto está no GitHub e possui integração contínua (CI/CD).
*   **Backend no Render (Web Service)**: 
    *   A API FastAPI está hospedada no serviço **Render**.
    *   Arquivos de configuração foram adicionados para suportar este deploy: `requirements.txt` (dependências Python), `Procfile` e `runtime.txt`.
    *   As variáveis de ambiente sensíveis (Chaves Supabase, Gemini) foram configuradas diretamente no dashboard do Render.
*   **Frontend na Vercel**: 
    *   A aplicação React foi configurada com o build script `npm run build` na Vercel. 
    *   Ela consome a URL de produção da API hospedada no Render para o tráfego do chat.


*Documentação gerada com base nas atualizações recentes da arquitetura do projeto.*
