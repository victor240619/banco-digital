package com.bravus.bank.config;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalBankDataProtectionTest {
    @TempDir
    Path tempDir;

    @Test
    void recordsFirstKnownCounts() {
        JdbcTemplate jdbc = jdbc("first-known-counts");
        createProtectedTables(jdbc);
        jdbc.update("INSERT INTO users (id) VALUES (1), (2)");
        jdbc.update("INSERT INTO transactions (id) VALUES (1)");

        Path marker = tempDir.resolve("marker.properties");
        LocalBankDataProtection protection = new LocalBankDataProtection(marker);

        assertDoesNotThrow(() -> protection.verifyCurrentCounts(jdbc));
        protection.rememberCurrentCounts(jdbc);

        assertTrue(marker.toFile().isFile());
    }

    @Test
    void refusesStartupWhenProtectedCountsDecrease() {
        JdbcTemplate original = jdbc("original-counts");
        createProtectedTables(original);
        original.update("INSERT INTO users (id) VALUES (1), (2)");
        original.update("INSERT INTO transactions (id) VALUES (1), (2), (3)");

        Path marker = tempDir.resolve("marker.properties");
        LocalBankDataProtection protection = new LocalBankDataProtection(marker);
        protection.rememberCurrentCounts(original);

        JdbcTemplate reset = jdbc("reset-counts");
        createProtectedTables(reset);
        reset.update("INSERT INTO users (id) VALUES (1)");

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> protection.verifyCurrentCounts(reset));
        assertTrue(ex.getMessage().contains("appears to have lost data"));
    }

    private JdbcTemplate jdbc(String name) {
        JdbcDataSource ds = new JdbcDataSource();
        ds.setURL("jdbc:h2:mem:" + name + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1");
        ds.setUser("sa");
        return new JdbcTemplate(ds);
    }

    private void createProtectedTables(JdbcTemplate jdbc) {
        jdbc.execute("CREATE TABLE users (id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE transactions (id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE external_transfer_orders (id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE credit_grants (id BIGINT PRIMARY KEY)");
    }
}
