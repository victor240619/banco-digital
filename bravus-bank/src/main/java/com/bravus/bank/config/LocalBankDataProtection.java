package com.bravus.bank.config;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

final class LocalBankDataProtection {
    private static final String PREFIX = "count.";
    private static final String[] PROTECTED_TABLES = {
            "users",
            "transactions",
            "external_transfer_orders",
            "credit_grants"
    };

    private final Path markerPath;

    LocalBankDataProtection(Path markerPath) {
        this.markerPath = markerPath;
    }

    void verifyCurrentCounts(JdbcTemplate jdbc) {
        if (!Files.exists(markerPath)) {
            return;
        }

        Properties previous = loadMarker();
        Map<String, Long> currentCounts = currentCounts(jdbc);
        for (Map.Entry<String, Long> entry : currentCounts.entrySet()) {
            long previousCount = parseLong(previous.getProperty(PREFIX + entry.getKey()));
            long currentCount = entry.getValue();
            if (previousCount > currentCount) {
                throw new IllegalStateException(
                        "Local Bravus database appears to have lost data in table "
                                + entry.getKey()
                                + " (previous count " + previousCount
                                + ", current count " + currentCount
                                + "). Refusing to seed local data over a possible reset. "
                                + "Restore the local database backup or remove "
                                + markerPath
                                + " only if this reset was intentional.");
            }
        }
    }

    void rememberCurrentCounts(JdbcTemplate jdbc) {
        Map<String, Long> counts = currentCounts(jdbc);
        Properties marker = new Properties();
        marker.setProperty("updatedAt", OffsetDateTime.now().toString());
        for (Map.Entry<String, Long> entry : counts.entrySet()) {
            marker.setProperty(PREFIX + entry.getKey(), Long.toString(entry.getValue()));
        }

        try {
            Path parent = markerPath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            try (OutputStream out = Files.newOutputStream(markerPath)) {
                marker.store(out, "Bravus local data protection marker. Do not delete unless resetting local data intentionally.");
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to write local data protection marker: " + markerPath, ex);
        }
    }

    private Map<String, Long> currentCounts(JdbcTemplate jdbc) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : PROTECTED_TABLES) {
            counts.put(table, countRows(jdbc, table));
        }
        return counts;
    }

    private long countRows(JdbcTemplate jdbc, String table) {
        try {
            Long count = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
            return count == null ? 0L : count;
        } catch (DataAccessException ex) {
            return 0L;
        }
    }

    private Properties loadMarker() {
        Properties props = new Properties();
        try (InputStream in = Files.newInputStream(markerPath)) {
            props.load(in);
            return props;
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read local data protection marker: " + markerPath, ex);
        }
    }

    private long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }
}
