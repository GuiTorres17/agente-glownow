-- ==========================================
-- Banco de Dados Lino Esmalteria (Supabase)
-- Atualizado em: 30/04/2026
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
    preco_cobrado DOUBLE PRECISION DEFAULT 0,
    valor_sinal DOUBLE PRECISION DEFAULT 0,
    sinal_pago DOUBLE PRECISION DEFAULT 0,
    forma_pagamento VARCHAR DEFAULT 'pix',
    observacoes TEXT,
    lembrete_enviado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Tabela: funcionarios (Autenticação do Painel Admin)
CREATE TABLE IF NOT EXISTS public.funcionarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    usuario VARCHAR UNIQUE NOT NULL,
    senha_hash VARCHAR NOT NULL,
    cargo VARCHAR DEFAULT 'atendente',
    ativo BOOLEAN DEFAULT TRUE,
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

-- ==========================================
-- DADOS INICIAIS: Serviços (Tabela de Preços Maisa Lino Esmalteria)
-- ==========================================

-- Limpar serviços antigos
DELETE FROM public.servicos;

-- Categoria: Manicure e Pedicure
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Manicure e Pedicure', 'Manicure',            30.00,  45, 'Aquele básico que te deixa pronta pra qualquer ocasião.', TRUE),
('Manicure e Pedicure', 'Pedicure',            30.00,  45, 'Cuidado completo das unhas dos pés.', TRUE),
('Manicure e Pedicure', 'Manicure & Pedicure', 55.00,  75, 'Combo mãos e pés com desconto.', TRUE),
('Manicure e Pedicure', 'Francesinha',          5.00,  15, 'Adicional de esmaltação no estilo francês.', TRUE),
('Manicure e Pedicure', 'Spa dos pés simples', 30.00,  45, 'Tratamento relaxante básico para os pés.', TRUE),
('Manicure e Pedicure', 'Spa dos pés completo',45.00,  60, 'Tratamento completo com esfoliação e hidratação.', TRUE);

-- Categoria: Esmaltação em Gel & Banho de Gel
-- Camada de gel nas unhas naturais formando uma película protetora para evitar quebras. Inclui cutilagem.
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + esmaltação comum',       90.00,  60, 'Banho de gel com esmaltação comum. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + esmaltação em gel',      100.00,  60, 'Banho de gel com esmaltação em gel. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + decoração simples',      110.00,  75, 'Banho de gel com decoração simples. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + decoração encapsulada',  115.00,  75, 'Banho de gel com decoração encapsulada. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Esmaltação em Gel | mãos',              25.00,  30, 'Esmaltação em gel nas mãos.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Esmaltação em Gel | pés',               25.00,  30, 'Esmaltação em gel nos pés.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Reconstrução unha do pé (por unha)',    20.00,  30, 'Reconstrução de unha do pé, valor por unha.', TRUE);

-- Categoria: Alongamento na Fibra de Vidro
-- Alongamento nos formatos Almond, Balarina e Quadrado
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Alongamento na Fibra de Vidro', 'Aplicação de fibra de vidro',                        160.00, 120, 'Aplicação de fibra de vidro. Formatos: Almond, Bailarina, Quadrado.', TRUE),
('Alongamento na Fibra de Vidro', 'Aplicação de fibra de vidro + esmaltação em gel',    170.00, 120, 'Fibra de vidro com esmaltação em gel. Formatos: Almond, Bailarina, Quadrado.', TRUE);

-- Categoria: Outras Decorações
-- Outras opções que temos no estúdio para diferenciar o seu alongamento
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Outras Decorações', 'Baby Boomer',             15.00,  30, 'Decoração no estilo Baby Boomer.', TRUE),
('Outras Decorações', 'Decoração básica',         15.00,  20, 'Decoração básica para diferenciação.', TRUE),
('Outras Decorações', 'Par de unha encapsulada',  15.00,  20, 'Encapsulamento de par de unhas.', TRUE),
('Outras Decorações', 'Todas unhas encapsulada',  35.00,  45, 'Encapsulamento de todas as unhas.', TRUE);

-- Categoria: Serviços à Parte
-- Serviços à parte feitos dentro e fora do dia da manutenção
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Serviços à Parte', 'Reposição de unha',       15.00,  30, 'Reposição de unha solta ou danificada.', TRUE),
('Serviços à Parte', 'Reparo lateral',            5.00,  15, 'Reparo lateral de unha.', TRUE),
('Serviços à Parte', 'Remoção de alongamento',   35.00,  45, 'Remoção completa do alongamento.', TRUE),
('Serviços à Parte', 'Remoção + nova aplicação',190.00, 150, 'Remoção do alongamento anterior e nova aplicação.', TRUE);

-- Categoria: Manutenção
-- Recomendamos no máximo de 30 dias para o retorno
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Manutenção', 'Manutenção esmaltação comum',        90.00,  90, 'Manutenção com esmaltação comum. Retorno em até 30 dias.', TRUE),
('Manutenção', 'Manutenção esmaltação em gel',       100.00,  90, 'Manutenção com esmaltação em gel. Retorno em até 30 dias.', TRUE),
('Manutenção', 'Manutenção de outro profissional',   110.00,  90, 'Manutenção de trabalho feito por outro profissional.', TRUE),
('Manutenção', 'Manutenção com mais de 30 dias',     120.00,  90, 'Manutenção com mais de 30 dias desde a última visita.', TRUE);