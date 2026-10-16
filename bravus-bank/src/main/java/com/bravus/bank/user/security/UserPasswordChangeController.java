package com.bravus.bank.user.security;

import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user/password")
public class UserPasswordChangeController {
    private final UserPasswordChangeService passwordChangeService;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;

    public UserPasswordChangeController(UserPasswordChangeService passwordChangeService,
                                        UserDetailsService userDetailsService,
                                        JwtService jwtService) {
        this.passwordChangeService = passwordChangeService;
        this.userDetailsService = userDetailsService;
        this.jwtService = jwtService;
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {}

    public record ChangePasswordResponse(
            String token,
            String username,
            String email,
            String fullName,
            String accountNumber,
            Long balance,
            Set<String> roles
    ) {}

    @PostMapping("/change")
    public ResponseEntity<?> changePassword(Authentication authentication,
                                            @RequestBody @Valid ChangePasswordRequest request) {
        try {
            UserEntity user = passwordChangeService.changePassword(
                    authentication.getName(), request.currentPassword(), request.newPassword());
            UserDetails details = userDetailsService.loadUserByUsername(user.getUsername());
            String token = jwtService.generateToken(details, user.getCredentialsVersion());
            Set<String> roles = user.getRoles().stream()
                    .map(RoleEntity::getName)
                    .collect(Collectors.toSet());
            ChangePasswordResponse response = new ChangePasswordResponse(
                    token,
                    user.getUsername(),
                    user.getEmail(),
                    user.getFullName(),
                    user.getAccountNumber(),
                    user.getBalance(),
                    roles
            );
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore().cachePrivate())
                    .header(HttpHeaders.VARY, HttpHeaders.AUTHORIZATION)
                    .body(response);
        } catch (UserPasswordChangeException exception) {
            return ResponseEntity.badRequest()
                    .cacheControl(CacheControl.noStore().cachePrivate())
                    .header(HttpHeaders.VARY, HttpHeaders.AUTHORIZATION)
                    .body(Map.of("code", exception.getCode(), "message", exception.getMessage()));
        }
    }
}
