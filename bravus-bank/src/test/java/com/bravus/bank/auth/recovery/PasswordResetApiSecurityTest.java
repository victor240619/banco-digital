package com.bravus.bank.auth.recovery;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:password-reset-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "jwt.secret=api-test-secret-key-that-is-long-enough-for-hmac-sha256",
        "BRAVUS_BIOMETRIC_KEY=api-test-biometric-key-with-high-entropy"
})
@AutoConfigureMockMvc
class PasswordResetApiSecurityTest {
    @Autowired MockMvc mockMvc;

    @Test
    void adminReviewIsForbiddenWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/admin/password-reset/requests"))
                .andExpect(status().isForbidden());
    }

    @Test
    void publicStartAcceptsUnknownIdentifierWithoutEnumeration() throws Exception {
        mockMvc.perform(post("/api/auth/password-reset/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "identifier": "unknown@example.com",
                                  "idempotencyKey": "api-idempotency-key-00000001",
                                  "clientSecret": "api-client-secret-with-at-least-thirty-two-characters"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.challenge").isNotEmpty())
                .andExpect(jsonPath("$.instruction").isNotEmpty());
    }

    @Test
    void publicStartRejectsMalformedProof() throws Exception {
        mockMvc.perform(post("/api/auth/password-reset/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"31415926590\",\"idempotencyKey\":\"short\",\"clientSecret\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }
}
