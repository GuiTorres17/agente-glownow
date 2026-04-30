# Agente Lino Esmalteria 💅

Bem-vindo(a) ao repositório do **Agente Lino Esmalteria**, um assistente virtual inteligente criado para automatizar e profissionalizar o atendimento, agendamentos e a gestão da clínica de estética Maisa Lino Esmalteria.

O agente utiliza Inteligência Artificial avançada para conversar com clientes de forma humana, natural e prestativa, integrando um frontend moderno e um backend robusto com banco de dados em nuvem.

---

## 🌟 Principais Funcionalidades

### Para o Cliente (Interface do Chat)
*   **Atendimento Humanizado:** Motor de IA com Google Gemini 1.5 Flash para uma conversa acolhedora e não-robótica.
*   **Reconhecimento Inteligente (Fuzzy Logic):** Entende intenções e nomes de serviços mesmo com erros de digitação.
*   **Cadastro Simplificado:** Fluxo guiado para novos clientes, identificação rápida via E-mail ou Celular.
*   **Agendamento Completo:** Escolha de data, serviço, profissional e horário de forma iterativa.
*   **Pagamento de Sinal (PIX):** Geração automática de PIX Copia e Cola para pré-pagamento (40%) obrigatório.
*   **Escape Universal:** O usuário pode digitar "cancelar", "sair" ou "voltar" a qualquer momento para abortar o fluxo atual.

### Para a Gestão (Painel Administrativo)
*   **Acesso Seguro e Secreto:** Acessível via chat apenas através de uma frase secreta.
*   **Dashboard em Tempo Real:** Visualização de KPIs diários e mensais (Faturamento, Agendamentos Confirmados/Pendentes).
*   **Gestão de Sinais:** Confirmação manual de pagamentos de PIX pendentes.
*   **Segurança Avançada:** Controle de acesso baseado em papéis (RBAC), Row Level Security (RLS) no Supabase, criptografia de dados sensíveis (celulares) e logs de auditoria.

---

## 🛠 Tecnologias Utilizadas

Este projeto adota uma arquitetura Cliente-Servidor moderna, dividida entre Frontend e Backend.

### Frontend (React & Vite)
*   **React (v18) + TypeScript:** Base estrutural para interfaces componentizadas e tipadas.
*   **Vite:** Build tool extremamente rápido.
*   **Tailwind CSS & Shadcn UI:** Estilização moderna, responsiva, com suporte a design *glassmorphism*.
*   **React Router DOM:** Gerenciamento de rotas (Chat Público vs. Painel Admin).
*   **Lucide React:** Biblioteca de ícones elegantes.
*   **React Query:** Gerenciamento de estado de requisições.

### Backend (Python & FastAPI)
*   **FastAPI:** Framework web rápido e eficiente para APIs RESTful.
*   **Google GenAI SDK:** Integração direta com a API do **Google Gemini 1.5 Flash**.
*   **Supabase (PostgreSQL):** Banco de dados relacional em nuvem, utilizando o cliente Python do Supabase.
*   **Fuzzywuzzy / Fuzzbook:** Algoritmos para correspondência aproximada de textos (Fuzzy Match).
*   **Uvicorn:** Servidor ASGI para rodar a aplicação web Python.
*   **Pydantic:** Validação de dados de entrada da API.

---

## 🚀 Deploy e Infraestrutura

A aplicação é preparada para a nuvem e utiliza integração e entrega contínuas (CI/CD) vinculadas ao GitHub.

*   **Frontend (Vercel):** Hospedagem otimizada para aplicações React/Vite com roteamento SPA (Single Page Application) configurado via `vercel.json`.
*   **Backend (Render):** Web Service rodando a API FastAPI, configurado com as variáveis de ambiente necessárias.
*   **Banco de Dados (Supabase):** Hospedagem do PostgreSQL gerenciado.

---

## 📄 Documentação Completa

Para detalhes técnicos profundos sobre a arquitetura do banco de dados (schema), fluxos de conversação específicos, tabela de preços completa ou histórico de atualizações, consulte o arquivo [DOCUMENTACAO.md](./DOCUMENTACAO.md).

---

## ⚙️ Como Executar Localmente

### Pré-requisitos
*   Node.js (v18+)
*   Python (3.9+)
*   Conta no Supabase (com banco configurado conforme `Banco_PI.sql`)
*   Chave de API do Google Gemini

### Backend (FastAPI)
1.  Crie um ambiente virtual: `python -m venv venv`
2.  Ative o ambiente virtual:
    *   Windows: `venv\Scripts\activate`
    *   Linux/Mac: `source venv/bin/activate`
3.  Instale as dependências: `pip install -r requirements.txt`
4.  Crie um arquivo `.env` na raiz e adicione suas credenciais:
    ```env
    GEMINI_API_KEY=sua_chave_gemini
    SUPABASE_URL=sua_url_supabase
    SUPABASE_KEY=sua_chave_anon_supabase
    ```
5.  Inicie o servidor: `uvicorn api:app --reload` (normalmente rodará em `http://localhost:8000`)

### Frontend (React)
1.  Abra um novo terminal.
2.  Instale as dependências NPM: `npm install`
3.  Crie um arquivo `.env.local` e configure a URL da API:
    ```env
    VITE_AGENT_URL=http://localhost:8000
    ```
4.  Inicie o servidor de desenvolvimento: `npm run dev`

---
*Desenvolvido com 💜 para a Lino Esmalteria.*
