-- ============================================================
-- V5 — Sistema Escritural Contábil do Bravus Bank
--
-- Implementa:
--   • Plano de Contas (ledger_accounts)
--   • Reserva Mestre (bank_reserve)
--   • Reservas Internas (internal_reserves)
--   • Concessão de Crédito (credit_grants)
--   • Uso de Crédito (credit_usages)
--   • Lançamentos Contábeis (ledger_entries) com hash chain SHA-256
--   • Logs administrativos (admin_action_logs)
--   • Notificações (notifications)
--
-- Capital base: R$ 700.000.000,00
-- Multiplicador: 10x  →  Capacidade total: R$ 7.000.000.000,00
--
-- TODOS OS VALORES EM CENTAVOS (BIGINT) para evitar erros de ponto flutuante.
-- R$ 700.000.000,00  =  70.000.000.000 centavos
-- ============================================================

-- ============================================================
-- 1) Plano de Contas
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ATIVO','PASSIVO','PATRIMONIO','RECEITA','DESPESA')),
    descricao TEXT,
    natureza VARCHAR(10) NOT NULL CHECK (natureza IN ('DEVEDORA','CREDORA')),
    saldo BIGINT NOT NULL DEFAULT 0,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    conta_pai_id BIGINT REFERENCES ledger_accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_accounts_codigo ON ledger_accounts(codigo);
CREATE INDEX idx_ledger_accounts_tipo ON ledger_accounts(tipo);

-- Plano de Contas obrigatório
INSERT INTO ledger_accounts (codigo, nome, tipo, natureza, descricao) VALUES
    -- ATIVO
    ('1.1.1',   'Caixa/Reserva do Banco',                'ATIVO',      'DEVEDORA', 'Reserva mestre — capital líquido do banco'),
    ('1.1.2.1', 'Reserva Alocada — Crédito Pessoal',     'ATIVO',      'DEVEDORA', 'Sub-caixa: parcela alocada à categoria Crédito Pessoal'),
    ('1.1.2.2', 'Reserva Alocada — Crédito Empresarial', 'ATIVO',      'DEVEDORA', 'Sub-caixa: parcela alocada à categoria Crédito Empresarial'),
    ('1.1.2.3', 'Reserva Alocada — Promocional',         'ATIVO',      'DEVEDORA', 'Sub-caixa: parcela alocada à categoria Promocional'),
    ('1.1.2.4', 'Reserva Alocada — Emergência',          'ATIVO',      'DEVEDORA', 'Sub-caixa: parcela alocada à categoria Emergência'),
    ('1.1.2.5', 'Reserva Alocada — Liquidez',            'ATIVO',      'DEVEDORA', 'Sub-caixa: parcela alocada à categoria Liquidez'),
    ('1.2.1',   'Créditos Concedidos a Clientes',        'ATIVO',      'DEVEDORA', 'Créditos escriturais concedidos (ainda não utilizados)'),
    ('1.2.2',   'Créditos em Uso',                       'ATIVO',      'DEVEDORA', 'Créditos utilizados em transações ativas'),
    ('1.2.3',   'Créditos Inadimplentes',                'ATIVO',      'DEVEDORA', 'Créditos não liquidados — provisão de perda'),
    -- PASSIVO
    ('2.1.1',   'Obrigações Escriturais',                'PASSIVO',    'CREDORA',  'Obrigações do banco perante clientes (saldo escritural devido)'),
    ('2.1.2',   'Créditos Liquidados',                   'PASSIVO',    'CREDORA',  'Créditos pagos/encerrados'),
    -- PATRIMÔNIO
    ('3.1.1',   'Capital do Banco',                      'PATRIMONIO', 'CREDORA',  'Capital declarado do Bravus Bank'),
    -- RESULTADO
    ('4.1.1',   'Receita de Juros',                      'RECEITA',    'CREDORA',  'Receita decorrente de juros sobre créditos'),
    ('5.1.1',   'Provisão para Inadimplência',           'DESPESA',    'DEVEDORA', 'Despesa de provisão para perdas com inadimplência');

-- ============================================================
-- 2) Reserva Mestre do Banco
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_reserve (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    total_capital BIGINT NOT NULL,
    total_emitido BIGINT NOT NULL DEFAULT 0,
    total_em_circulacao BIGINT NOT NULL DEFAULT 0,
    total_liquidado BIGINT NOT NULL DEFAULT 0,
    total_inadimplente BIGINT NOT NULL DEFAULT 0,
    saldo_disponivel_emissao BIGINT NOT NULL,
    fator_multiplicador INTEGER NOT NULL DEFAULT 10,
    capacidade_total_emissao BIGINT NOT NULL,
    moeda VARCHAR(3) NOT NULL DEFAULT 'BRL',
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','SUSPENSA','ENCERRADA')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_capital_positive CHECK (total_capital > 0),
    CONSTRAINT check_emitido_nao_negativo CHECK (total_emitido >= 0),
    CONSTRAINT check_emitido_dentro_capacidade CHECK (total_emitido <= capacidade_total_emissao),
    CONSTRAINT check_multiplicador_positivo CHECK (fator_multiplicador > 0)
);

-- Seed da Reserva Mestre — R$ 700.000.000,00 (em centavos)
INSERT INTO bank_reserve (
    nome, total_capital, saldo_disponivel_emissao,
    fator_multiplicador, capacidade_total_emissao, moeda, status
) VALUES (
    'Reserva Mestre Bravus Bank',
    70000000000,
    700000000000,             -- 7 bi disponíveis para emissão (capital * mult)
    10,
    700000000000,
    'BRL',
    'ATIVA'
);

-- ============================================================
-- 3) Reservas Internas (categorias)
-- ============================================================
CREATE TABLE IF NOT EXISTS internal_reserves (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    valor_total BIGINT NOT NULL,
    valor_alocado BIGINT NOT NULL DEFAULT 0,
    valor_disponivel BIGINT NOT NULL,
    finalidade TEXT,
    ledger_account_codigo VARCHAR(20) NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_valor_total_positivo CHECK (valor_total > 0),
    CONSTRAINT check_valor_alocado_nao_excede CHECK (valor_alocado <= valor_total),
    CONSTRAINT check_valor_alocado_nao_negativo CHECK (valor_alocado >= 0)
);

INSERT INTO internal_reserves (codigo, nome, valor_total, valor_disponivel, finalidade, ledger_account_codigo) VALUES
    ('CREDITO_PESSOAL',     'Reserva de Crédito Pessoal',     20000000000, 20000000000, 'Crédito pessoal para clientes pessoa física',  '1.1.2.1'),
    ('CREDITO_EMPRESARIAL', 'Reserva de Crédito Empresarial', 20000000000, 20000000000, 'Crédito para pessoas jurídicas',                '1.1.2.2'),
    ('PROMOCIONAL',         'Reserva Promocional',            10000000000, 10000000000, 'Crédito inicial para novos usuários',           '1.1.2.3'),
    ('EMERGENCIA',          'Reserva de Emergência',          10000000000, 10000000000, 'Reserva de segurança do banco',                 '1.1.2.4'),
    ('LIQUIDEZ',            'Reserva de Liquidez',            10000000000, 10000000000, 'Garantia de liquidez para saques e pagamentos', '1.1.2.5');

-- ============================================================
-- 4) Concessão de Crédito
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_grants (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    internal_reserve_id BIGINT NOT NULL REFERENCES internal_reserves(id) ON DELETE RESTRICT,
    valor_concedido BIGINT NOT NULL,
    valor_disponivel BIGINT NOT NULL,
    valor_usado BIGINT NOT NULL DEFAULT 0,
    valor_liquidado BIGINT NOT NULL DEFAULT 0,
    valor_inadimplente BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO'
        CHECK (status IN ('PENDENTE','APROVADO','ATIVO','SUSPENSO','LIQUIDADO','INADIMPLENTE','CANCELADO')),
    motivo_concessao TEXT,
    regra_elegibilidade TEXT,
    taxa_juros_anual NUMERIC(5,2) DEFAULT 0,
    data_concessao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_vencimento TIMESTAMPTZ,
    aprovado_por BIGINT REFERENCES users(id),
    ledger_entry_id BIGINT,
    observacoes TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_valor_concedido_positivo CHECK (valor_concedido > 0),
    CONSTRAINT check_valor_disponivel_nao_negativo CHECK (valor_disponivel >= 0),
    CONSTRAINT check_consistencia_valores
        CHECK (valor_disponivel + valor_usado + valor_liquidado + valor_inadimplente = valor_concedido)
);

CREATE INDEX idx_credit_grants_user ON credit_grants(user_id);
CREATE INDEX idx_credit_grants_status ON credit_grants(status);
CREATE INDEX idx_credit_grants_data ON credit_grants(data_concessao DESC);

-- ============================================================
-- 5) Lançamentos Contábeis com Hash Chain
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    sequencia BIGINT NOT NULL UNIQUE,
    data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    descricao TEXT NOT NULL,
    debito_conta_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
    credito_conta_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
    valor BIGINT NOT NULL,
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('CONSTITUICAO','ALOCACAO_RESERVA','CONCESSAO','USO','LIQUIDACAO','INADIMPLENCIA','ESTORNO','AJUSTE')),
    referencia_id BIGINT,
    referencia_tipo VARCHAR(50),
    hash VARCHAR(64) NOT NULL UNIQUE,
    hash_anterior VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADO'
        CHECK (status IN ('PENDENTE','CONFIRMADO','ESTORNADO')),
    criado_por VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_valor_positivo CHECK (valor > 0),
    CONSTRAINT check_contas_diferentes CHECK (debito_conta_id != credito_conta_id)
);

CREATE INDEX idx_ledger_entries_sequencia ON ledger_entries(sequencia);
CREATE INDEX idx_ledger_entries_data ON ledger_entries(data DESC);
CREATE INDEX idx_ledger_entries_tipo ON ledger_entries(tipo);
CREATE INDEX idx_ledger_entries_referencia ON ledger_entries(referencia_tipo, referencia_id);

ALTER TABLE credit_grants
    ADD CONSTRAINT fk_credit_grants_ledger
    FOREIGN KEY (ledger_entry_id) REFERENCES ledger_entries(id);

-- ============================================================
-- 6) Uso de Crédito
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_usages (
    id BIGSERIAL PRIMARY KEY,
    credit_grant_id BIGINT NOT NULL REFERENCES credit_grants(id) ON DELETE RESTRICT,
    transaction_id BIGINT REFERENCES transactions(id),
    valor BIGINT NOT NULL,
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('TRANSFERENCIA_INTERNA','PIX','BOLETO','PAGAMENTO','SAQUE')),
    saldo_antes BIGINT NOT NULL,
    saldo_depois BIGINT NOT NULL,
    ledger_entry_id BIGINT NOT NULL REFERENCES ledger_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_valor_uso_positivo CHECK (valor > 0)
);

CREATE INDEX idx_credit_usages_grant ON credit_usages(credit_grant_id);
CREATE INDEX idx_credit_usages_transaction ON credit_usages(transaction_id);

-- ============================================================
-- 7) Logs administrativos
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES users(id),
    admin_username VARCHAR(100) NOT NULL,
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(100),
    entidade_id BIGINT,
    detalhes JSONB,
    ip_origem VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin ON admin_action_logs(admin_id);
CREATE INDEX idx_admin_logs_data ON admin_action_logs(created_at DESC);

-- ============================================================
-- 8) Notificações
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    referencia_tipo VARCHAR(50),
    referencia_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user ON notifications(user_id, lida);
