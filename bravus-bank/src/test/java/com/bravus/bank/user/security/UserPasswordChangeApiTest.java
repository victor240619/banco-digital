package com.bravus.bank.user.security;

import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.RoleRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.security.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:password-change-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "jwt.secret=password-change-api-test-secret-long-enough-for-hmac-sha256",
        "BRAVUS_BIOMETRIC_KEY=password-change-api-test-biometric-key-with-high-entropy"
})
@AutoConfigureMockMvc
class UserPasswordChangeApiTest {
    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired UserCredentialAuditRepository auditRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserDetailsService userDetailsService;
    @Autowired JwtService jwtService;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        auditRepository.deleteAll();
        userRepository.deleteAll();
        roleRepository.deleteAll();
    }

    @Test
    void passwordChangeRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/user/password/change")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"SenhaAtual123\",\"newPassword\":\"NovaSenha456\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void administratorCanChangeOwnPasswordAndKeepOnlyRenewedSessionValid() throws Exception {
        UserEntity admin = createUser("security.admin", "ROLE_ADMIN", "SenhaAtual123", "731001");
        UserDetails details = userDetailsService.loadUserByUsername(admin.getUsername());
        String oldToken = jwtService.generateToken(details, admin.getCredentialsVersion());

        String body = mockMvc.perform(post("/api/user/password/change")
                        .with(user(admin.getUsername()).roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"SenhaAtual123\",\"newPassword\":\"NovaSenha456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.username").value(admin.getUsername()))
                .andExpect(jsonPath("$.roles[0]").value("ROLE_ADMIN"))
                .andReturn().getResponse().getContentAsString();

        UserEntity updated = userRepository.findByUsername(admin.getUsername()).orElseThrow();
        assertTrue(passwordEncoder.matches("NovaSenha456", updated.getPassword()));
        assertFalse(passwordEncoder.matches("SenhaAtual123", updated.getPassword()));
        assertEquals(1L, updated.getCredentialsVersion());
        assertEquals(1L, auditRepository.count());
        assertFalse(jwtService.isTokenValid(oldToken, details, updated.getCredentialsVersion()));

        JsonNode response = objectMapper.readTree(body);
        assertTrue(jwtService.isTokenValid(response.get("token").asText(), details, updated.getCredentialsVersion()));
    }

    private UserEntity createUser(String username, String roleName, String password, String accountNumber) {
        RoleEntity role = new RoleEntity();
        role.setName(roleName);
        role.setDescription("test role");
        role = roleRepository.saveAndFlush(role);

        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(username + "@example.test");
        user.setPassword(passwordEncoder.encode(password));
        user.setFullName("Security Admin");
        user.setAccountNumber(accountNumber);
        user.setBalance(0L);
        user.setIsActive(true);
        user.setRoles(Set.of(role));
        return userRepository.saveAndFlush(user);
    }
}
