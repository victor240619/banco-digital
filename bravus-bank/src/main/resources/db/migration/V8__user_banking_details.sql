-- ============================================================
-- V8: Dados bancários profissionais nos usuários
-- ============================================================
-- Adiciona campos que todo banco digital sério tem:
-- agência, código do banco, chave PIX, data de nascimento, etc.
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS agencia          VARCHAR(10)  DEFAULT '0001' NOT NULL,
    ADD COLUMN IF NOT EXISTS codigo_banco     VARCHAR(10)  DEFAULT '999'  NOT NULL,
    ADD COLUMN IF NOT EXISTS nome_banco       VARCHAR(100) DEFAULT 'Bravus Premium Bank' NOT NULL,
    ADD COLUMN IF NOT EXISTS ispb             VARCHAR(20)  DEFAULT '99999999',
    ADD COLUMN IF NOT EXISTS chave_pix        VARCHAR(120),
    ADD COLUMN IF NOT EXISTS tipo_chave_pix   VARCHAR(20)  DEFAULT 'CPF',
    ADD COLUMN IF NOT EXISTS data_nascimento  DATE,
    ADD COLUMN IF NOT EXISTS nome_mae         VARCHAR(200),
    ADD COLUMN IF NOT EXISTS endereco_cep     VARCHAR(10),
    ADD COLUMN IF NOT EXISTS endereco_rua     VARCHAR(200),
    ADD COLUMN IF NOT EXISTS endereco_numero  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS endereco_cidade  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS endereco_uf      VARCHAR(2),
    ADD COLUMN IF NOT EXISTS profissao        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS renda_mensal     BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status_kyc       VARCHAR(20) DEFAULT 'VERIFICADO',
    ADD COLUMN IF NOT EXISTS nivel_conta      VARCHAR(20) DEFAULT 'PREMIUM',
    ADD COLUMN IF NOT EXISTS limite_credito   BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS limite_pix_diario BIGINT DEFAULT 1000000; -- R$ 10.000,00

-- Backfill da chave PIX: usa CPF (limpo, só dígitos) por padrão
UPDATE users
SET chave_pix = REGEXP_REPLACE(cpf, '[^0-9]', '', 'g'),
    tipo_chave_pix = 'CPF'
WHERE chave_pix IS NULL AND cpf IS NOT NULL;

-- Garante que agência tem prefixo zero
UPDATE users SET agencia = '0001' WHERE agencia IS NULL OR agencia = '';

-- Cria índice na chave PIX pra busca rápida
CREATE INDEX IF NOT EXISTS idx_users_chave_pix ON users(chave_pix) WHERE chave_pix IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_agencia_conta ON users(agencia, account_number);

-- Tabela de comprovantes (gerados a cada transação)
CREATE TABLE IF NOT EXISTS comprovantes (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id),
    transaction_id       BIGINT,
    ledger_entry_id      BIGINT REFERENCES ledger_entries(id),
    tipo                 VARCHAR(30) NOT NULL,
    descricao            TEXT,
    valor_centavos       BIGINT NOT NULL,
    contraparte_nome     VARCHAR(200),
    contraparte_documento VARCHAR(50),
    contraparte_banco    VARCHAR(100),
    contraparte_agencia  VARCHAR(20),
    contraparte_conta    VARCHAR(50),
    autenticacao         VARCHAR(64) NOT NULL UNIQUE,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comprovantes_user ON comprovantes(user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_comprovantes_autenticacao ON comprovantes(autenticacao);

-- Comentários de documentação
COMMENT ON COLUMN users.agencia IS 'Agência da conta (default 0001 - única agência Bravus)';
COMMENT ON COLUMN users.codigo_banco IS 'Código COMPE do banco (999 = Bravus Premium Bank, fictício)';
COMMENT ON COLUMN users.chave_pix IS 'Chave PIX principal do usuário';
COMMENT ON COLUMN users.nivel_conta IS 'PREMIUM | BLACK | INFINITY';
COMMENT ON COLUMN users.status_kyc IS 'PENDENTE | EM_ANALISE | VERIFICADO | REJEITADO';
