-- ==========================================
-- Banco de Dados Lino Esmalteria (Supabase)
-- ==========================================

-- Tabela: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    celular VARCHAR UNIQUE,
    data_nascimento VARCHAR,
    cep VARCHAR,
    endereco VARCHAR,
    complemento VARCHAR,
    data_cadastro TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    ativo BOOLEAN DEFAULT TRUE,
    preferencias JSONB
);

-- Tabela: manicures
CREATE TABLE IF NOT EXISTS public.manicures (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    especialidades JSONB,
    horarios_disponiveis JSONB,
    ativo BOOLEAN DEFAULT TRUE,
    bio TEXT
);

-- Tabela: servicos
CREATE TABLE IF NOT EXISTS public.servicos (
    id SERIAL PRIMARY KEY,
    categoria VARCHAR NOT NULL,
    nome VARCHAR NOT NULL,
    preco DOUBLE PRECISION NOT NULL,
    duracao INTEGER DEFAULT 60,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE
);

-- Tabela: agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES public.clientes(id),
    manicure_id INTEGER REFERENCES public.manicures(id),
    servico_id INTEGER REFERENCES public.servicos(id),
    data VARCHAR NOT NULL,
    horario VARCHAR,
    hora_fim VARCHAR,
    status VARCHAR DEFAULT 'confirmado',
    sinal_pago DOUBLE PRECISION DEFAULT 0,
    observacoes TEXT,
    lembrete_enviado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Tabela: conversas (Histórico do Chat)
CREATE TABLE IF NOT EXISTS public.conversas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES public.clientes(id),
    mensagem TEXT,
    resposta TEXT,
    contexto VARCHAR,
    sentimento VARCHAR,
    data TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Tabela: estoque (Gerenciamento de Produtos)
CREATE TABLE IF NOT EXISTS public.estoque (
    id SERIAL PRIMARY KEY,
    produto VARCHAR NOT NULL,
    quantidade INTEGER DEFAULT 0,
    unidade_medida VARCHAR DEFAULT 'unidades',
    nivel_minimo INTEGER DEFAULT 5,
    ultima_atualizacao TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);