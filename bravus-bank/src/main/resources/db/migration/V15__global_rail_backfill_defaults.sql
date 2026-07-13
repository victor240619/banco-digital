-- Backfill local/prod rows that existed before the Global Rail settlement fields.
UPDATE external_transfer_orders
   SET settlement_status = 'DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO'
 WHERE settlement_status IS NULL;

UPDATE external_transfer_orders
   SET receipt_kind = 'COMPROVANTE_SAIDA_BRAVUS'
 WHERE receipt_kind IS NULL;

ALTER TABLE external_transfer_orders
    ALTER COLUMN settlement_status SET DEFAULT 'DEBITADA_NO_BRAVUS_AGUARDANDO_CONEXAO_DESTINO';

ALTER TABLE external_transfer_orders
    ALTER COLUMN receipt_kind SET DEFAULT 'COMPROVANTE_SAIDA_BRAVUS';

ALTER TABLE external_transfer_orders
    ALTER COLUMN settlement_status SET NOT NULL;

ALTER TABLE external_transfer_orders
    ALTER COLUMN receipt_kind SET NOT NULL;
