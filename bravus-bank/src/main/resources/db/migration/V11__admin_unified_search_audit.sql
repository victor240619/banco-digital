-- ============================================================
-- V11 - Auditoria da consulta unificada administrativa
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_search_audit (
    id BIGSERIAL PRIMARY KEY,
    query_text VARCHAR(255) NOT NULL,
    query_type VARCHAR(40) NOT NULL,
    normalized_query VARCHAR(255),
    result_count INTEGER NOT NULL DEFAULT 0,
    requested_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_search_audit_created
    ON admin_search_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_search_audit_query
    ON admin_search_audit(query_type, normalized_query);
