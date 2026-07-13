package com.bravus.bank;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:bravus-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "jwt.secret=DEV_ONLY_test_profile_change_me_64_bytes_minimum_aaaaaaaaaaaaaaaaaaaaaaaa"
})
class BravusBankApplicationTests {

    @Test
    void contextLoads() {
        // Test that Spring Boot context loads successfully
    }
}
