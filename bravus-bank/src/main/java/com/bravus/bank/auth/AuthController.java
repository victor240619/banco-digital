package com.bravus.bank.auth;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    public record RegisterRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotBlank String password,
            @NotBlank String confirmPassword,
            @NotBlank @Pattern(regexp = "(PF|PJ)") String type,
            String document,
            String phone
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AuthResponse(
            String token,
            UserInfo user,
            String message
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UserInfo(
            String id,
            String name,
            String email,
            String type,
            String document,
            String phone,
            Boolean isAdmin,
            Long balance
    ) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequest request) {
        // Simulação de autenticação - em produção, implementar autenticação real
        if ("admin@bravus.com".equals(request.email()) && "admin123".equals(request.password())) {
            UserInfo admin = new UserInfo(
                    "admin-1",
                    "Administrador",
                    "admin@bravus.com",
                    "PJ",
                    null,
                    null,
                    true,
                    0L
            );
            return ResponseEntity.ok(new AuthResponse("admin-token-123", admin, "Login realizado com sucesso"));
        }

        if ("user@bravus.com".equals(request.email()) && "user123".equals(request.password())) {
            UserInfo user = new UserInfo(
                    "user-1",
                    "João Silva",
                    "user@bravus.com",
                    "PF",
                    "123.456.789-00",
                    "(11) 99999-9999",
                    false,
                    1500050L // R$ 15.000,50 em centavos
            );
            return ResponseEntity.ok(new AuthResponse("user-token-123", user, "Login realizado com sucesso"));
        }

        Map<String, String> error = new HashMap<>();
        error.put("message", "Credenciais inválidas");
        return ResponseEntity.status(401).body(error);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest request) {
        // Validar se as senhas coincidem
        if (!request.password().equals(request.confirmPassword())) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "As senhas não coincidem");
            return ResponseEntity.badRequest().body(error);
        }

        // Simulação de registro - em produção, salvar no banco de dados
        UserInfo newUser = new UserInfo(
                "user-" + System.currentTimeMillis(),
                request.name(),
                request.email(),
                request.type(),
                request.document(),
                request.phone(),
                false,
                0L
        );

        String token = "token-" + System.currentTimeMillis();
        return ResponseEntity.ok(new AuthResponse(token, newUser, "Conta criada com sucesso"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Logout realizado com sucesso");
        return ResponseEntity.ok(response);
    }
}