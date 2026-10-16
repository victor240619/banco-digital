-- Keep the database column types aligned with the JPA String mappings.
-- USING btrim preserves the three-letter currency codes stored by the earlier CHAR columns.
ALTER TABLE account_ledger_entries
    ALTER COLUMN currency TYPE VARCHAR(3) USING btrim(currency)::VARCHAR(3);

ALTER TABLE mercado_pago_pix_orders
    ALTER COLUMN currency TYPE VARCHAR(3) USING btrim(currency)::VARCHAR(3);
