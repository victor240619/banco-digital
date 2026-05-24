-- ============================================================
-- V6 — Bloco Gênesis + Alocações de Abertura
--
-- 6 primeiros lançamentos contábeis (imutáveis) do Bravus Bank:
--
--   seq=1 CONSTITUICAO     1.1.1 ← 3.1.1   R$ 700.000.000,00
--   seq=2 ALOCACAO         1.1.2.1 ← 1.1.1 R$ 200.000.000,00  (Crédito Pessoal)
--   seq=3 ALOCACAO         1.1.2.2 ← 1.1.1 R$ 200.000.000,00  (Crédito Empresarial)
--   seq=4 ALOCACAO         1.1.2.3 ← 1.1.1 R$ 100.000.000,00  (Promocional)
--   seq=5 ALOCACAO         1.1.2.4 ← 1.1.1 R$ 100.000.000,00  (Emergência)
--   seq=6 ALOCACAO         1.1.2.5 ← 1.1.1 R$ 100.000.000,00  (Liquidez)
--
-- Modelo contábil:
--   • CONSTITUIÇÃO cria o capital: ATIVO (Caixa) ↑ + PATRIMÔNIO (Capital) ↑
--   • ALOCAÇÕES movimentam o ATIVO entre sub-caixas (não criam passivo).
--   • PASSIVO 2.1.1 só cresce quando crédito é EFETIVAMENTE CONCEDIDO a cliente.
--
-- Hash chain SHA-256 determinística:
--   payload = "{prev_hash}|{seq}|{data}|{valor_centavos}|{deb}|{cred}|{tipo}|{ref}"
--
-- Data fixa do gênesis: 2026-05-24T00:00:00Z
-- ============================================================

-- seq=1 — CONSTITUIÇÃO
INSERT INTO ledger_entries (sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior, status, criado_por, observacao)
VALUES (
    1, '2026-05-24T00:00:00Z', 'Constituição do Capital Inicial — Bravus Bank',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.1'),
    (SELECT id FROM ledger_accounts WHERE codigo = '3.1.1'),
    70000000000, 'CONSTITUICAO', 1, 'BankReserve',
    '90cb24ed5df68096f0d623367832bb10ba9aec1d086b7243752c16aca347d99f',
    '0000000000000000000000000000000000000000000000000000000000000000',
    'CONFIRMADO', 'SYSTEM', 'Bloco gênesis — abertura contábil do Bravus Bank');

-- seq=2 — ALOCACAO Crédito Pessoal
INSERT INTO ledger_entries (sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior, status, criado_por, observacao)
VALUES (
    2, '2026-05-24T00:00:00Z', 'Alocação para Reserva de Crédito Pessoal',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.2.1'),
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.1'),
    20000000000, 'ALOCACAO_RESERVA', 1, 'InternalReserve',
    'f4023fbc38e230a6f43a568c96de9301911e49a8e12a0a8cb31cf03c9d8542e9',
    '90cb24ed5df68096f0d623367832bb10ba9aec1d086b7243752c16aca347d99f',
    'CONFIRMADO', 'SYSTEM', 'Alocação inicial — Reserva de Crédito Pessoal');

-- seq=3 — ALOCACAO Crédito Empresarial
INSERT INTO ledger_entries (sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior, status, criado_por, observacao)
VALUES (
    3, '2026-05-24T00:00:00Z', 'Alocação para Reserva de Crédito Empresarial',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.2.2'),
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.1'),
    20000000000, 'ALOCACAO_RESERVA', 2, 'InternalReserve',
    'd84bc137821d4cede29dfc2c9c4be87ceba42b8038607668f0b23e21679149e7',
    'f4023fbc38e230a6f43a568c96de9301911e49a8e12a0a8cb31cf03c9d8542e9',
    'CONFIRMADO', 'SYSTEM', 'Alocação inicial — Reserva de Crédito Empresarial');

-- seq=4 — ALOCACAO Promocional
INSERT INTO ledger_entries (sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior, status, criado_por, observacao)
VALUES (
    4, '2026-05-24T00:00:00Z', 'Alocação para Reserva Promocional',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.2.3'),
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.1'),
    10000000000, 'ALOCACAO_RESERVA', 3, 'InternalReserve',
    '082e93909c7fd6ef414d06244ed3d392f6ead290df51a34f3597be0e8af66f86',
    'd84bc137821d4cede29dfc2c9c4be87ceba42b8038607668f0b23e21679149e7',
    'CONFIRMADO', 'SYSTEM', 'Alocação inicial — Reserva Promocional');

-- seq=5 — ALOCACAO Emergência
INSERT INTO ledger_entries (sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior, status, criado_por, observacao)
VALUES (
    5, '2026-05-24T00:00:00Z', 'Alocação para Reserva de Emergência',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.2.4'),
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.1'),
    10000000000, 'ALOCACAO_RESERVA', 4, 'InternalReserve',
    'ec326768fd851b069a9d2d0a2109b5dd6c3bfcd7da9bcfb84b37779a53630f30',
    '082e93909c7fd6ef414d06244ed3d392f6ead290df51a34f3597be0e8af66f86',
    'CONFIRMADO', 'SYSTEM', 'Alocação inicial — Reserva de Emergência');

-- seq=6 — ALOCACAO Liquidez
INSERT INTO ledger_entries (sequencia, data, descricao, debito_conta_id, credito_conta_id,
    valor, tipo, referencia_id, referencia_tipo, hash, hash_anterior, status, criado_por, observacao)
VALUES (
    6, '2026-05-24T00:00:00Z', 'Alocação para Reserva de Liquidez',
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.2.5'),
    (SELECT id FROM ledger_accounts WHERE codigo = '1.1.1'),
    10000000000, 'ALOCACAO_RESERVA', 5, 'InternalReserve',
    '563fdd66437015acebb5029916bbc6879a84afe8b66f2e97d057cf04d2aa301a',
    'ec326768fd851b069a9d2d0a2109b5dd6c3bfcd7da9bcfb84b37779a53630f30',
    'CONFIRMADO', 'SYSTEM', 'Alocação inicial — Reserva de Liquidez');

-- ============================================================
-- Atualizar saldos das contas (reflexo dos 6 lançamentos)
-- ============================================================
--   1.1.1 (DEVEDORA): +700mi (seq=1) - 700mi (seq=2..6) = 0
--   1.1.2.1: +200mi  |  1.1.2.2: +200mi  |  1.1.2.3..5: +100mi cada
--   3.1.1 (CREDORA): +700mi
--   2.1.1 PASSIVO: zero — só cresce quando crédito for concedido a cliente

UPDATE ledger_accounts SET saldo = 0           WHERE codigo = '1.1.1';
UPDATE ledger_accounts SET saldo = 20000000000 WHERE codigo = '1.1.2.1';
UPDATE ledger_accounts SET saldo = 20000000000 WHERE codigo = '1.1.2.2';
UPDATE ledger_accounts SET saldo = 10000000000 WHERE codigo = '1.1.2.3';
UPDATE ledger_accounts SET saldo = 10000000000 WHERE codigo = '1.1.2.4';
UPDATE ledger_accounts SET saldo = 10000000000 WHERE codigo = '1.1.2.5';
UPDATE ledger_accounts SET saldo = 70000000000 WHERE codigo = '3.1.1';

-- ============================================================
-- Trigger de imutabilidade da cadeia
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.sequencia    != NEW.sequencia    OR
           OLD.hash         != NEW.hash         OR
           OLD.hash_anterior != NEW.hash_anterior OR
           OLD.valor        != NEW.valor        OR
           OLD.debito_conta_id  != NEW.debito_conta_id OR
           OLD.credito_conta_id != NEW.credito_conta_id OR
           OLD.data         != NEW.data OR
           OLD.tipo         != NEW.tipo THEN
            RAISE EXCEPTION 'Lançamento contábil é imutável (sequencia=%, hash=%)', OLD.sequencia, OLD.hash;
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Lançamento contábil não pode ser deletado (sequencia=%, hash=%)', OLD.sequencia, OLD.hash;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_immutable
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
