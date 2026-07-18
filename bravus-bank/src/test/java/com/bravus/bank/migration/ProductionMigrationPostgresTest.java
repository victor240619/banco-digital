package com.bravus.bank.migration;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProductionMigrationPostgresTest {
    @Test
    void importsVerifiedProductionStateOnRealPostgres() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            Flyway flyway = Flyway.configure()
                    .dataSource(postgres.getPostgresDatabase())
                    .locations("classpath:db/migration")
                    .validateOnMigrate(true)
                    .load();

            assertEquals(20, flyway.migrate().migrationsExecuted);
            assertEquals(0, flyway.migrate().migrationsExecuted);

            try (Connection connection = postgres.getPostgresDatabase().getConnection()) {
                JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
                assertEquals(3, count(jdbc, "SELECT COUNT(*) FROM users"));
                assertEquals(3, count(jdbc,
                        "SELECT COUNT(*) FROM users WHERE outbound_operations_enabled = TRUE"));
                assertEquals("false", jdbc.queryForObject("""
                        SELECT column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'users'
                          AND column_name = 'outbound_operations_enabled'
                        """, String.class));
                assertEquals(1, count(jdbc, """
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'users'
                          AND column_name = 'numeric_access_password'
                        """));
                assertEquals(77991100L, amount(jdbc,
                        "SELECT balance FROM users WHERE username = 'joao.victor'"));
                assertEquals(10908900L, amount(jdbc,
                        "SELECT balance FROM users WHERE username = 'francisca.reis'"));
                assertEquals(88900000L, amount(jdbc,
                        "SELECT SUM(balance) FROM users WHERE username IN ('joao.victor', 'francisca.reis')"));
                assertEquals(89000000L, amount(jdbc,
                        "SELECT valor_concedido FROM credit_grants WHERE user_id = 2"));
                assertEquals(77991100L, amount(jdbc,
                        "SELECT valor_disponivel FROM credit_grants WHERE user_id = 2"));
                assertEquals(11008900L, amount(jdbc,
                        "SELECT valor_usado FROM credit_grants WHERE user_id = 2"));

                assertEquals(5, count(jdbc, "SELECT COUNT(*) FROM transactions"));
                assertEquals(2, count(jdbc, "SELECT COUNT(*) FROM internal_transfer_requests"));
                assertEquals(6, count(jdbc, "SELECT COUNT(*) FROM account_ledger_entries"));
                assertEquals(0L, amount(jdbc,
                        "SELECT COALESCE(SUM(signed_amount_centavos), 0) FROM account_ledger_entries"));
                assertEquals(0, count(jdbc, """
                        SELECT COUNT(*)
                        FROM (
                            SELECT transfer_id
                            FROM account_ledger_entries
                            GROUP BY transfer_id
                            HAVING COUNT(*) <> 2 OR SUM(signed_amount_centavos) <> 0
                        ) broken
                        """));

                assertEquals(8, count(jdbc, "SELECT COUNT(*) FROM ledger_entries"));
                assertEquals(0, count(jdbc, """
                        SELECT COUNT(*)
                        FROM (
                            SELECT sequencia, hash_anterior,
                                   LAG(hash) OVER (ORDER BY sequencia) AS expected_previous
                            FROM ledger_entries
                        ) chain
                        WHERE sequencia > 1 AND hash_anterior <> expected_previous
                        """));
                assertEquals(1, count(jdbc,
                        "SELECT COUNT(*) FROM production_state_imports WHERE marker = 'SITES_SNAPSHOT_2026_07_14_194827Z'"));

                assertThrows(SQLException.class, () -> {
                    try (Statement statement = connection.createStatement()) {
                        statement.executeUpdate(
                                "UPDATE account_ledger_entries SET signed_amount_centavos = 1 WHERE id = 1");
                    }
                });
            }
        }
    }

    private int count(JdbcTemplate jdbc, String sql) {
        return jdbc.queryForObject(sql, Integer.class);
    }

    private long amount(JdbcTemplate jdbc, String sql) {
        return jdbc.queryForObject(sql, Long.class);
    }
}
