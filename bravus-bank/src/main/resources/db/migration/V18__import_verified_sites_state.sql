-- Verified production snapshot captured from the legacy Sites runtime at
-- 2026-07-14T19:48:27.177Z. This migration is intentionally fail-closed: it
-- only imports into a database that still contains the untouched seed users.

CREATE TABLE production_state_imports (
    marker VARCHAR(100) PRIMARY KEY,
    source_url VARCHAR(500) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_customer_balance_centavos BIGINT NOT NULL,
    notes TEXT NOT NULL
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM transactions) THEN
        RAISE EXCEPTION 'Production snapshot import refused: transactions already exist';
    END IF;
    IF EXISTS (SELECT 1 FROM external_transfer_orders) THEN
        RAISE EXCEPTION 'Production snapshot import refused: external orders already exist';
    END IF;
    IF EXISTS (SELECT 1 FROM account_ledger_entries) THEN
        RAISE EXCEPTION 'Production snapshot import refused: account ledger already exists';
    END IF;
    IF EXISTS (
        SELECT 1 FROM users
        WHERE username NOT IN ('admin', 'user', 'admin_bravus')
    ) THEN
        RAISE EXCEPTION 'Production snapshot import refused: non-seed users already exist';
    END IF;
END $$;

-- Remove disposable seed identities and convert the original admin into the
-- live Bravus administrator. Referential tables are empty at this point.
DELETE FROM user_roles
WHERE user_id IN (SELECT id FROM users WHERE username IN ('user', 'admin_bravus'));
DELETE FROM users WHERE username IN ('user', 'admin_bravus');

UPDATE users
SET username = 'admin@bravusbank.com',
    email = 'admin@bravusbank.com',
    password = '$2b$12$sa2bxsVLhhlaicU6lopIAebkm15yFT24k3n7D5VGFcgKZCNdl9K52',
    full_name = 'Administrador Bravus Local',
    cpf = NULL,
    phone = '',
    balance = 0,
    account_number = '0000000003',
    account_type = 'CORRENTE',
    is_active = TRUE,
    agencia = '0001',
    codigo_banco = '999',
    nome_banco = 'Bravus Premium Bank',
    ispb = '99999999',
    chave_pix = NULL,
    tipo_chave_pix = 'CPF',
    status_kyc = 'APROVADO_AUTO',
    nivel_conta = 'PREMIUM',
    credentials_version = 0,
    version = 0,
    updated_at = NOW()
WHERE username = 'admin';

INSERT INTO users (
    id, username, email, password, full_name, cpf, phone, balance,
    account_number, account_type, is_active, agencia, codigo_banco,
    nome_banco, ispb, chave_pix, tipo_chave_pix, status_kyc, nivel_conta,
    limite_credito, limite_pix_diario, credentials_version, version,
    created_at, updated_at
) VALUES
(
    2,
    'joao.victor',
    'pulmaturcruzeiros@gmail.com',
    '$2b$12$sa2bxsVLhhlaicU6lopIAebkm15yFT24k3n7D5VGFcgKZCNdl9K52',
    U&'Joao Victor Mendon\00E7a Guimaraes',
    '05569161155',
    '',
    77991100,
    '0556916115',
    'CORRENTE',
    TRUE,
    '0001',
    '999',
    'Bravus Premium Bank',
    '99999999',
    '05569161155',
    'CPF',
    'APROVADO_AUTO',
    'PREMIUM',
    0,
    1000000,
    0,
    0,
    '2026-07-12T22:31:05-03:00',
    '2026-07-14T19:48:27.177Z'
),
(
    3,
    'francisca.reis',
    'melynievict@gmail.com',
    '$2b$12$sa2bxsVLhhlaicU6lopIAebkm15yFT24k3n7D5VGFcgKZCNdl9K52',
    'Francisca de Assis dos Reis',
    '00829040145',
    '',
    10908900,
    '0082904014',
    'CORRENTE',
    TRUE,
    '0001',
    '999',
    'Bravus Premium Bank',
    '99999999',
    '00829040145',
    'CPF',
    'APROVADO_AUTO',
    'PREMIUM',
    0,
    1000000,
    0,
    0,
    '2026-07-13T01:58:37.974Z',
    '2026-07-14T19:48:27.177Z'
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'ROLE_USER'
WHERE u.username IN ('joao.victor', 'francisca.reis');

INSERT INTO transactions (
    id, user_id, type, amount, description, destination_account,
    status, created_at, version
) VALUES
(
    1, 2, 'TRANSFER_OUT', 13209800, 'Transferencia interna reconciliada',
    '0082904014', 'COMPLETED', '2026-07-14T01:58:37.974Z', 0
),
(
    2, 3, 'TRANSFER_IN', 13209800, 'Transferencia interna reconciliada',
    '0556916115', 'COMPLETED', '2026-07-14T01:58:37.974Z', 0
),
(
    3, 3, 'TRANSFER_OUT', 2300900, 'Transferencia interna Bravus',
    '0556916115', 'COMPLETED', '2026-07-14T02:54:16.438Z', 0
),
(
    4, 2, 'TRANSFER_IN', 2300900, 'Transferencia interna Bravus',
    '0082904014', 'COMPLETED', '2026-07-14T02:54:16.438Z', 0
),
(
    5, 2, 'WITHDRAWAL', 100000, 'Operacao ChatGPT Sites',
    NULL, 'COMPLETED', '2026-07-14T02:56:47.575Z', 0
);

INSERT INTO external_transfer_orders (
    id, user_id, requested_by, transaction_id, amount_centavos, channel,
    currency, beneficiary_name, beneficiary_document, bank_code, ispb,
    agency, account_number, account_type, pix_key, pix_key_type, description,
    provider, provider_transfer_id, idempotency_key, status, error_message,
    raw_response, settlement_status, receipt_kind, destination_network,
    destination_participant_code, destination_confirmation_id,
    destination_confirmed_at, settlement_message, created_at, updated_at
) VALUES
(
    1, 2, 2, 1, 13209800, 'PIX', 'BRL',
    'Francisca de Assis dos Reis', '00829040145', '999', '99999999',
    '0001', '0082904014', 'CORRENTE', '00829040145', 'CPF',
    'Transferencia interna reconciliada', 'BRAVUS_INTERNAL_LEDGER',
    'sites-legacy-internal-1783994317974', 'sites-legacy-internal-1783994317974',
    'COMPLETED', NULL,
    '{"provider":"BRAVUS_INTERNAL_LEDGER","status":"COMPLETED","settlement":"INTERNAL_LEDGER"}',
    'LIQUIDADA_CONFIRMADA', 'COMPROVANTE_LIQUIDACAO_CONFIRMADA',
    'INTERNAL_BRAVUS', 'BRAVUS-INTERNAL', 'sites-legacy-internal-1783994317974',
    '2026-07-14T01:58:37.974Z', 'Liquidacao interna confirmada no ledger Bravus.',
    '2026-07-14T01:58:37.974Z', '2026-07-14T01:58:37.974Z'
),
(
    2, 3, 3, 3, 2300900, 'PIX', 'BRL',
    U&'Joao Victor Mendon\00E7a Guimaraes', '05569161155', '999', '99999999',
    '0001', '0556916115', 'CORRENTE', '05569161155', 'CPF',
    'Transferencia interna Bravus', 'BRAVUS_INTERNAL_LEDGER',
    'sites-orphan-internal-3-4', 'sites-orphan-internal-3-4',
    'COMPLETED', NULL,
    '{"provider":"BRAVUS_INTERNAL_LEDGER","status":"COMPLETED","settlement":"INTERNAL_LEDGER"}',
    'LIQUIDADA_CONFIRMADA', 'COMPROVANTE_LIQUIDACAO_CONFIRMADA',
    'INTERNAL_BRAVUS', 'BRAVUS-INTERNAL', 'sites-orphan-internal-3-4',
    '2026-07-14T02:54:16.438Z',
    'Transferencia concluida encontrada no extrato e reconciliada no ledger Bravus.',
    '2026-07-14T02:54:16.438Z', '2026-07-14T02:54:16.438Z'
);

INSERT INTO internal_transfer_requests (
    id, user_id, destination_user_id, idempotency_key, amount_centavos,
    description, status, out_transaction_id, in_transaction_id,
    receipt_order_id, created_at, completed_at, version
) VALUES
(
    '00000000-0000-0000-0000-000000000001', 2, 3,
    'sites-legacy-internal-1783994317974', 13209800,
    'Transferencia interna reconciliada', 'COMPLETED', 1, 2, 1,
    '2026-07-14T01:58:37.974Z', '2026-07-14T01:58:37.974Z', 0
),
(
    '00000000-0000-0000-0000-000000000002', 3, 2,
    'sites-orphan-internal-3-4', 2300900,
    'Transferencia interna Bravus', 'COMPLETED', 3, 4, 2,
    '2026-07-14T02:54:16.438Z', '2026-07-14T02:54:16.438Z', 0
);

INSERT INTO account_ledger_entries (
    transfer_request_id, transfer_id, transaction_id, external_order_id,
    user_id, account_number, entry_type, signed_amount_centavos,
    currency, reason, created_at
) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'sites-legacy-internal-1783994317974', 1, 1, 2, '0556916115',
    'debit', -13209800, 'BRL', 'RECONCILIATION', '2026-07-14T01:58:37.974Z'
),
(
    '00000000-0000-0000-0000-000000000001',
    'sites-legacy-internal-1783994317974', 2, 1, 3, '0082904014',
    'credit', 13209800, 'BRL', 'RECONCILIATION', '2026-07-14T01:58:37.974Z'
),
(
    '00000000-0000-0000-0000-000000000002',
    'sites-orphan-internal-3-4', 3, 2, 3, '0082904014',
    'debit', -2300900, 'BRL', 'TRANSACTION_PAIR_RECONCILIATION', '2026-07-14T02:54:16.438Z'
),
(
    '00000000-0000-0000-0000-000000000002',
    'sites-orphan-internal-3-4', 4, 2, 2, '0556916115',
    'credit', 2300900, 'BRL', 'TRANSACTION_PAIR_RECONCILIATION', '2026-07-14T02:54:16.438Z'
),
(
    NULL, 'sites-transaction-5-WITHDRAWAL', 5, NULL, 2, '0556916115',
    'debit', -100000, 'BRL', 'TRANSACTION_RECONCILIATION', '2026-07-14T02:56:47.575Z'
),
(
    NULL, 'sites-transaction-5-WITHDRAWAL', 5, NULL, NULL, 'BRAVUS-LEDGER',
    'credit', 100000, 'BRL', 'TRANSACTION_RECONCILIATION', '2026-07-14T02:56:47.575Z'
);

INSERT INTO credit_grants (
    id, user_id, internal_reserve_id, valor_concedido, valor_disponivel,
    valor_usado, valor_liquidado, valor_inadimplente, status,
    motivo_concessao, regra_elegibilidade, taxa_juros_anual,
    data_concessao, data_vencimento, aprovado_por, ledger_entry_id,
    observacoes, version, created_at, updated_at
) VALUES (
    1,
    2,
    (SELECT id FROM internal_reserves WHERE codigo = 'CREDITO_PESSOAL'),
    89000000,
    77991100,
    11008900,
    0,
    0,
    'ATIVO',
    'Credito escritural inicial para Joao Victor',
    'BRAVUS_LOCAL_JOAO_CREDIT_890000',
    24.00,
    '2026-07-12T22:31:05-03:00',
    '2031-07-12T22:31:05-03:00',
    1,
    NULL,
    'Credito migrado do snapshot Sites verificado.',
    0,
    '2026-07-12T22:31:05-03:00',
    '2026-07-14T19:48:27.177Z'
);

INSERT INTO ledger_entries (
    sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior,
    status, criado_por, observacao
) VALUES
(
    7,
    '2026-07-13T01:31:05Z',
    'Importacao do credito escritural inicial de Joao Victor',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.2.1'),
    (SELECT id FROM ledger_accounts WHERE codigo = '2.1.1'),
    89000000,
    'CONCESSAO',
    1,
    'CreditGrant',
    '1bdf63d7bdd7f5b379e9b229303e7c950a151cd2801528f38f0ade65bf457477',
    '563fdd66437015acebb5029916bbc6879a84afe8b66f2e97d057cf04d2aa301a',
    'CONFIRMADO',
    'SYSTEM_IMPORT',
    'Snapshot Sites capturado em 2026-07-14T19:48:27.177Z'
),
(
    8,
    '2026-07-14T02:56:47.575Z',
    'Saque reconciliado do snapshot Sites',
    (SELECT id FROM ledger_accounts WHERE codigo = '2.1.1'),
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.2.5'),
    100000,
    'LIQUIDACAO',
    5,
    'Transaction',
    'b483e07e9cf8d38455353813244b26fc93354befd82d02acc8deb3d30035a6ff',
    '1bdf63d7bdd7f5b379e9b229303e7c950a151cd2801528f38f0ade65bf457477',
    'CONFIRMADO',
    'SYSTEM_IMPORT',
    'Operacao ChatGPT Sites reconciliada'
);

UPDATE credit_grants
SET ledger_entry_id = (SELECT id FROM ledger_entries WHERE sequencia = 7)
WHERE id = 1;

UPDATE ledger_accounts SET saldo = saldo + 89000000 WHERE codigo = '1.2.1';
UPDATE ledger_accounts SET saldo = saldo + 88900000 WHERE codigo = '2.1.1';
UPDATE ledger_accounts SET saldo = saldo - 100000 WHERE codigo = '1.1.2.5';

UPDATE internal_reserves
SET valor_alocado = valor_alocado + 89000000,
    valor_disponivel = valor_disponivel - 89000000,
    updated_at = NOW()
WHERE codigo = 'CREDITO_PESSOAL';

UPDATE bank_reserve
SET total_emitido = total_emitido + 89000000,
    total_em_circulacao = total_em_circulacao + 88900000,
    updated_at = NOW()
WHERE id = (SELECT MIN(id) FROM bank_reserve);

INSERT INTO global_rail_participants (
    participant_code, legal_name, country, network, bank_code, ispb,
    auth_mode, connection_mode, settlement_account, supports_instant,
    status, created_at, updated_at
) VALUES (
    'BRAVUS-INTERNAL', 'Bravus Premium Bank', 'KY', 'INTERNAL_BRAVUS',
    '999', '99999999', 'NONE', 'SELF_LEDGER', 'BRAVUS-LEDGER', TRUE,
    'ACTIVE', '2026-07-14T01:58:37.974Z', '2026-07-14T19:48:27.177Z'
);

INSERT INTO admin_action_logs (
    admin_id, admin_username, acao, entidade, detalhes, ip_origem,
    user_agent, created_at
) VALUES (
    1,
    'admin@bravusbank.com',
    'PRODUCTION_STATE_IMPORTED',
    'production_state_imports',
    '{"source":"ChatGPT Sites verified snapshot","joaoBalanceCentavos":77991100,"franciscaBalanceCentavos":10908900,"customerTotalCentavos":88900000,"transactionCount":5,"accountLedgerEntryCount":6}'::jsonb,
    'SYSTEM',
    'Flyway V18',
    NOW()
);

INSERT INTO production_state_imports (
    marker, source_url, captured_at, expected_customer_balance_centavos, notes
) VALUES (
    'SITES_SNAPSHOT_2026_07_14_194827Z',
    'https://bravus-bank-240619.victor2406.chatgpt.site',
    '2026-07-14T19:48:27.177Z',
    88900000,
    'Joao 77991100 + Francisca 10908900; five transactions; six balanced account-ledger entries.'
);

SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users), TRUE);
SELECT setval(pg_get_serial_sequence('transactions', 'id'), (SELECT MAX(id) FROM transactions), TRUE);
SELECT setval(pg_get_serial_sequence('external_transfer_orders', 'id'), (SELECT MAX(id) FROM external_transfer_orders), TRUE);
SELECT setval(pg_get_serial_sequence('account_ledger_entries', 'id'), (SELECT MAX(id) FROM account_ledger_entries), TRUE);
SELECT setval(pg_get_serial_sequence('credit_grants', 'id'), (SELECT MAX(id) FROM credit_grants), TRUE);
SELECT setval(pg_get_serial_sequence('ledger_entries', 'id'), (SELECT MAX(id) FROM ledger_entries), TRUE);
