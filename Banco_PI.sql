-- -----------------------------------------------------------------------------
-- 1. CLIENTES
--    Login feito por e-mail OU celular (CPF removido do fluxo do agente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR NOT NULL,
  email            VARCHAR UNIQUE,                   -- login por email
  celular          VARCHAR UNIQUE,                   -- login por celular (normalizado, só números)
  data_nascimento  VARCHAR,
  cep              VARCHAR,
  endereco         VARCHAR,
  complemento      VARCHAR,
  data_cadastro    TIMESTAMP DEFAULT now(),
  ativo            BOOLEAN DEFAULT true,
  preferencias     JSONB
);

-- Ao menos um dos dois (email ou celular) deve ser preenchido
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_contato_check
  CHECK (email IS NOT NULL OR celular IS NOT NULL);


-- -----------------------------------------------------------------------------
-- 2. MANICURES (Profissionais)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manicures (
  id                   SERIAL PRIMARY KEY,
  nome                 VARCHAR NOT NULL,
  especialidades       JSONB,          -- ex: ["Manicure", "Pedicure"]
  horarios_disponiveis JSONB,          -- ex: {"seg": ["09:00","10:30"], ...}
  ativo                BOOLEAN DEFAULT true,
  bio                  TEXT
);


-- -----------------------------------------------------------------------------
-- 3. SERVIÇOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.servicos (
  id        SERIAL PRIMARY KEY,
  categoria VARCHAR NOT NULL,          -- ex: "Mãos", "Pés", "Unhas"
  nome      VARCHAR NOT NULL,          -- ex: "Manicure", "Alongamento"
  preco     DOUBLE PRECISION NOT NULL,
  duracao   INTEGER NOT NULL DEFAULT 60, -- duração em minutos
  descricao TEXT,
  ativo     BOOLEAN DEFAULT true
);


-- -----------------------------------------------------------------------------
-- 4. AGENDAMENTOS
--    Usa IDs de FK para manicure e serviço + campos compatíveis com agente.py
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id               SERIAL PRIMARY KEY,
  cliente_id       INTEGER NOT NULL REFERENCES public.clientes(id),
  manicure_id      INTEGER REFERENCES public.manicures(id),
  servico_id       INTEGER REFERENCES public.servicos(id),
  data             VARCHAR NOT NULL,   -- formato DD/MM/YYYY (como exibido ao cliente)
  horario          VARCHAR,            -- ex: "09:00"
  hora_fim         VARCHAR,            -- calculado a partir da duração do serviço
  status           VARCHAR DEFAULT 'confirmado',  -- confirmado | cancelado | concluido
  sinal_pago       DOUBLE PRECISION DEFAULT 0,
  observacoes      TEXT,
  lembrete_enviado BOOLEAN DEFAULT false,
  criado_em        TIMESTAMP DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 5. CONVERSAS (Histórico de mensagens — opcional, para análise futura)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversas (
  id         SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES public.clientes(id),
  mensagem   TEXT,
  resposta   TEXT,
  contexto   VARCHAR,
  sentimento VARCHAR,
  data       TIMESTAMP DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 6. ESTOQUE (Controle interno de produtos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estoque (
  id                 SERIAL PRIMARY KEY,
  produto            VARCHAR NOT NULL,
  quantidade         INTEGER DEFAULT 0,
  unidade_medida     VARCHAR DEFAULT 'unidades',
  nivel_minimo       INTEGER DEFAULT 5,
  ultima_atualizacao TIMESTAMP DEFAULT now()
);


-- =============================================================================
-- DADOS DE EXEMPLO — remova em produção se preferir inserir pelo painel
-- =============================================================================

-- Profissionais
INSERT INTO public.manicures (nome, especialidades, horarios_disponiveis, ativo, bio)
VALUES
  ('Helena', '["Manicure", "Pedicure"]',
   '{"seg":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "ter":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "qua":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "qui":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "sex":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "sab":["09:00","10:30","12:00","14:00"]}',
   true, 'Especialista em manicure e pedicure com 5 anos de experiência.'),

  ('Joana', '["Alongamento", "Manicure", "Fibra de Vidro"]',
   '{"seg":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "ter":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "qua":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "qui":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "sex":["09:00","10:30","12:00","14:00","15:30","17:00"],
     "sab":["09:00","10:30","12:00","14:00"]}',
   true, 'Especialista em alongamento e fibra de vidro.');

-- Serviços
INSERT INTO public.servicos (categoria, nome, preco, duracao, descricao, ativo)
VALUES
  ('Mãos',  'Manicure',           30.00,  45, 'Cuidado completo das unhas das mãos com esmaltação.', true),
  ('Pés',   'Pedicure',           40.00,  60, 'Cuidado completo das unhas dos pés com esmaltação.', true),
  ('Unhas', 'Esmaltação em Gel',  60.00,  60, 'Esmaltação de longa duração com gel UV.', true),
  ('Unhas', 'Alongamento',       120.00, 120, 'Alongamento de unhas com molde e gel.', true),
  ('Unhas', 'Fibra de Vidro',    110.00, 120, 'Alongamento resistente com fibra de vidro.', true),
  ('Pés',   'Spa dos Pés',        65.00,  75, 'Tratamento relaxante com esfoliação e hidratação.', true),
  ('Unhas', 'Francesinha',        45.00,  60, 'Esmaltação clássica no estilo francês.', true),
  ('Unhas', 'Decoração',          15.00,  20, 'Arte e decoração nas unhas (por unha ou mão inteira).', true);

-- Cliente demo para testes do agente
INSERT INTO public.clientes (nome, email, celular, ativo)
VALUES ('Maria Silva', 'demo@linoesmalteria.com', '11999999999', true)
ON CONFLICT DO NOTHING;