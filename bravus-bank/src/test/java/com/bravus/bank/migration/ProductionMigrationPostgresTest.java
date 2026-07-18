package com.bravus.bank.migration;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductionMigrationPostgresTest {
    @Test
    void importsVerifiedProductionStateOnRealPostgres() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            Flyway flyway = Flyway.configure()
                    .dataSource(postgres.getPostgresDatabase())
                    .locations("classpath:db/migration")
                    .validateOnMigrate(true)
                    .load();

            assertEquals(22, flyway.migrate().migrationsExecuted);
            assertEquals(0, flyway.migrate().migrationsExecuted);

            try (Connection connection = postgres.getPostgresDatabase().getConnection()) {
                JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
                assertEquals(3, count(jdbc, "SELECT COUNT(*) FROM users"));
                assertEquals(0, count(jdbc,
                        "SELECT COUNT(*) FROM users WHERE account_number !~ '^[0-9]{6}$' OR account_number = '000000'"));
                assertEquals("916115", jdbc.queryForObject(
                        "SELECT account_number FROM users WHERE username = 'joao.victor'", String.class));
                assertEquals("904014", jdbc.queryForObject(
                        "SELECT account_number FROM users WHERE username = 'francisca.reis'", String.class));
                assertEquals(3, count(jdbc, "SELECT COUNT(*) FROM account_number_aliases"));
                assertEquals(1, count(jdbc, """
                        SELECT COUNT(*)
                        FROM external_transfer_orders transfer_order
                        WHERE transfer_order.beneficiary_document = '00829040145'
                          AND transfer_order.amount_centavos = 13209800
                          AND transfer_order.account_number IN (
                              SELECT account_number FROM users WHERE username = 'francisca.reis'
                              UNION ALL
                              SELECT alias.account_number
                              FROM account_number_aliases alias
                              JOIN users user_record ON user_record.id = alias.user_id
                              WHERE user_record.username = 'francisca.reis'
                          )
                        """));
                assertEquals(6, count(jdbc,
                        "SELECT COUNT(*) FROM account_ledger_entries WHERE account_number IN ('0556916115', '0082904014', 'BRAVUS-LEDGER')"));
                assertEquals(0, count(jdbc, "SELECT COUNT(*) FROM users WHERE ispb IS NOT NULL"));
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
                assertThrows(SQLException.class, () -> {
                    try (Statement statement = connection.createStatement()) {
                        statement.executeUpdate(
                                "INSERT INTO account_number_aliases (user_id, account_number) VALUES (1, '000003')");
                    }
                });
                try (Statement statement = connection.createStatement()) {
                    statement.executeUpdate(
                            "INSERT INTO account_number_aliases (user_id, account_number) VALUES (1, '654321')");
                }
                assertThrows(SQLException.class, () -> {
                    try (Statement statement = connection.createStatement()) {
                        statement.executeUpdate("UPDATE users SET account_number = '654321' WHERE id = 2");
                    }
                });

                try (Connection aliasConnection = postgres.getPostgresDatabase().getConnection();
                     Connection userConnection = postgres.getPostgresDatabase().getConnection()) {
                    aliasConnection.setAutoCommit(false);
                    userConnection.setAutoCommit(false);
                    try (Statement statement = aliasConnection.createStatement()) {
                        statement.executeUpdate(
                                "INSERT INTO account_number_aliases (user_id, account_number) VALUES (1, '777777')");
                    }

                    ExecutorService executor = Executors.newSingleThreadExecutor();
                    try {
                        Future<Boolean> rejectedAfterLock = executor.submit(() -> {
                            try (Statement statement = userConnection.createStatement()) {
                                statement.executeUpdate("UPDATE users SET account_number = '777777' WHERE id = 2");
                                userConnection.commit();
                                return false;
                            } catch (SQLException expected) {
                                userConnection.rollback();
                                return true;
                            }
                        });

                        Thread.sleep(200);
                        assertFalse(rejectedAfterLock.isDone());
                        aliasConnection.commit();
                        assertTrue(rejectedAfterLock.get(5, TimeUnit.SECONDS));
                    } finally {
                        executor.shutdownNow();
                    }
                }
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
