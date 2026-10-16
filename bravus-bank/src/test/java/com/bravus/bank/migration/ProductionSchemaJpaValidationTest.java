package com.bravus.bank.migration;

import com.bravus.bank.BravusBankApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import javax.sql.DataSource;
import java.io.IOException;

@SpringBootTest(
        classes = BravusBankApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.flyway.enabled=true",
                "spring.flyway.validate-on-migrate=true",
                "jwt.secret=DEV_ONLY_schema_validation_secret_64_bytes_minimum_aaaaaaaaaaaa"
        })
@Import(ProductionSchemaJpaValidationTest.PostgresConfiguration.class)
class ProductionSchemaJpaValidationTest {
    @Test
    void applicationStartsWithFlywaySchemaValidatedByHibernate() {
        // Context startup is the assertion: Flyway migrates and Hibernate validates every mapped column.
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PostgresConfiguration {
        @Bean(destroyMethod = "close")
        EmbeddedPostgres embeddedPostgres() throws IOException {
            return EmbeddedPostgres.builder().start();
        }

        @Bean
        DataSource dataSource(EmbeddedPostgres postgres) {
            return postgres.getPostgresDatabase();
        }
    }
}
