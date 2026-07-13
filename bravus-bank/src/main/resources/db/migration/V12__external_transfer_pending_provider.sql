-- Permite registrar uma ordem externa rastreavel enquanto o provedor bancario
-- autorizado ainda nao esta configurado. A transacao contabil so baixa saldo
-- quando o provedor real aceita/processa a ordem.
DO $$
DECLARE
    status_constraint TEXT;
BEGIN
    SELECT conname
      INTO status_constraint
      FROM pg_constraint
     WHERE conrelid = 'external_transfer_orders'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%status%'
     LIMIT 1;

    IF status_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE external_transfer_orders DROP CONSTRAINT %I', status_constraint);
    END IF;
END $$;

ALTER TABLE external_transfer_orders
    ADD CONSTRAINT external_transfer_orders_status_check
    CHECK (status IN ('PENDING','PENDING_PROVIDER','PROCESSING','COMPLETED','FAILED'));
