-- ==========================================
-- Banco de Dados Lino Esmalteria (Supabase)
-- Atualizado em: 30/04/2026 — v3.0 (Segurança & Governança)
-- ==========================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    celular VARCHAR UNIQUE,
    celular_encrypted BYTEA,
    data_nascimento VARCHAR,
    cep VARCHAR,
    endereco VARCHAR,
    complemento VARCHAR,
    data_cadastro TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    ativo BOOLEAN DEFAULT TRUE,
    preferencias JSONB
);

-- Tabela: manicures (com RBAC)
CREATE TABLE IF NOT EXISTS public.manicures (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    especialidades JSONB,
    horarios_disponiveis JSONB,
    ativo BOOLEAN DEFAULT TRUE,
    bio TEXT,
    role VARCHAR DEFAULT 'manicure' CHECK (role IN ('admin', 'manicure'))
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
    sinal_confirmado BOOLEAN DEFAULT FALSE,
    forma_pagamento VARCHAR DEFAULT 'pix',
    observacoes TEXT,
    lembrete_enviado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Tabela: historico_conversas (substituiu a antiga 'conversas')
CREATE TABLE IF NOT EXISTS public.historico_conversas (
    id SERIAL PRIMARY KEY,
    sessao_id VARCHAR NOT NULL,
    cliente_id INTEGER REFERENCES public.clientes(id) ON DELETE SET NULL,
    mensagem_usuario TEXT NOT NULL,
    resposta_agente TEXT NOT NULL,
    intencao_detectada VARCHAR,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Tabela: audit_logs (Rastreabilidade e Governança)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    tabela_afetada VARCHAR NOT NULL,
    acao VARCHAR NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
    registro_id INTEGER,
    dados_antigos JSONB,
    dados_novos JSONB,
    executado_por VARCHAR DEFAULT 'system',
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Índices de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_logs(tabela_afetada);
CREATE INDEX IF NOT EXISTS idx_audit_criado_em ON public.audit_logs(criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_registro_id ON public.audit_logs(registro_id);

-- ==========================================
-- FUNÇÕES DE CRIPTOGRAFIA (pgcrypto)
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'lino_esmalteria_2026_secure_key';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.encrypt_celular(phone TEXT)
RETURNS BYTEA AS $$
BEGIN
    IF phone IS NULL OR phone = '' THEN RETURN NULL; END IF;
    RETURN pgp_sym_encrypt(phone, public.get_encryption_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrypt_celular(encrypted_phone BYTEA)
RETURNS TEXT AS $$
BEGIN
    IF encrypted_phone IS NULL THEN RETURN NULL; END IF;
    RETURN pgp_sym_decrypt(encrypted_phone, public.get_encryption_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para acesso descriptografado (admin/API)
CREATE OR REPLACE VIEW public.vw_clientes_decrypted AS
SELECT
    id, nome, email,
    CASE
        WHEN celular_encrypted IS NOT NULL
        THEN pgp_sym_decrypt(celular_encrypted, public.get_encryption_key())
        ELSE celular
    END AS celular,
    data_nascimento, cep, endereco, complemento,
    data_cadastro, ativo, preferencias
FROM public.clientes;

-- ==========================================
-- TRIGGER DE AUDITORIA
-- ==========================================

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (tabela_afetada, acao, registro_id, dados_antigos, dados_novos, executado_por)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, NULL, to_jsonb(NEW), COALESCE(current_setting('app.current_user', true), 'system'));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (tabela_afetada, acao, registro_id, dados_antigos, dados_novos, executado_por)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW), COALESCE(current_setting('app.current_user', true), 'system'));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (tabela_afetada, acao, registro_id, dados_antigos, dados_novos, executado_por)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, to_jsonb(OLD), NULL, COALESCE(current_setting('app.current_user', true), 'system'));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER trg_audit_agendamentos
    AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_clientes
    AFTER INSERT OR UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ==========================================
-- DADOS INICIAIS: Serviços (Tabela de Preços Maisa Lino Esmalteria)
-- ==========================================

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
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + esmaltação comum',       90.00,  60, 'Banho de gel com esmaltação comum. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + esmaltação em gel',      100.00,  60, 'Banho de gel com esmaltação em gel. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + decoração simples',      110.00,  75, 'Banho de gel com decoração simples. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Banho de gel + decoração encapsulada',  115.00,  75, 'Banho de gel com decoração encapsulada. Inclui cutilagem.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Esmaltação em Gel | mãos',              25.00,  30, 'Esmaltação em gel nas mãos.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Esmaltação em Gel | pés',               25.00,  30, 'Esmaltação em gel nos pés.', TRUE),
('Esmaltação em Gel & Banho de Gel', 'Reconstrução unha do pé (por unha)',    20.00,  30, 'Reconstrução de unha do pé, valor por unha.', TRUE);

-- Categoria: Alongamento na Fibra de Vidro
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Alongamento na Fibra de Vidro', 'Aplicação de fibra de vidro',                        160.00, 120, 'Aplicação de fibra de vidro. Formatos: Almond, Bailarina, Quadrado.', TRUE),
('Alongamento na Fibra de Vidro', 'Aplicação de fibra de vidro + esmaltação em gel',    170.00, 120, 'Fibra de vidro com esmaltação em gel. Formatos: Almond, Bailarina, Quadrado.', TRUE);

-- Categoria: Outras Decorações
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Outras Decorações', 'Baby Boomer',             15.00,  30, 'Decoração no estilo Baby Boomer.', TRUE),
('Outras Decorações', 'Decoração básica',         15.00,  20, 'Decoração básica para diferenciação.', TRUE),
('Outras Decorações', 'Par de unha encapsulada',  15.00,  20, 'Encapsulamento de par de unhas.', TRUE),
('Outras Decorações', 'Todas unhas encapsulada',  35.00,  45, 'Encapsulamento de todas as unhas.', TRUE);

-- Categoria: Serviços à Parte
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Serviços à Parte', 'Reposição de unha',       15.00,  30, 'Reposição de unha solta ou danificada.', TRUE),
('Serviços à Parte', 'Reparo lateral',            5.00,  15, 'Reparo lateral de unha.', TRUE),
('Serviços à Parte', 'Remoção de alongamento',   35.00,  45, 'Remoção completa do alongamento.', TRUE),
('Serviços à Parte', 'Remoção + nova aplicação',190.00, 150, 'Remoção do alongamento anterior e nova aplicação.', TRUE);

-- Categoria: Manutenção
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo) VALUES
('Manutenção', 'Manutenção esmaltação comum',        90.00,  90, 'Manutenção com esmaltação comum. Retorno em até 30 dias.', TRUE),
('Manutenção', 'Manutenção esmaltação em gel',       100.00,  90, 'Manutenção com esmaltação em gel. Retorno em até 30 dias.', TRUE),
('Manutenção', 'Manutenção de outro profissional',   110.00,  90, 'Manutenção de trabalho feito por outro profissional.', TRUE),
('Manutenção', 'Manutenção com mais de 30 dias',     120.00,  90, 'Manutenção com mais de 30 dias desde a última visita.', TRUE);