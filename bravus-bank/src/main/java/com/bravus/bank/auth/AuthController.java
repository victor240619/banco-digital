package com.bravus.bank.auth;

import com.bravus.bank.compliance.AccountOpeningKycService;
import com.bravus.bank.compliance.DocumentAnalysisEntity;
import com.bravus.bank.compliance.DocumentAnalysisService;
import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.RoleRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.security.JwtService;
import com.bravus.bank.validator.PasswordValidator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final DocumentAnalysisService documentAnalysisService;
    private final AccountOpeningKycService accountOpeningKycService;
    private final SecureRandom secureRandom = new SecureRandom();
    
    public AuthController(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            UserDetailsService userDetailsService,
            DocumentAnalysisService documentAnalysisService,
            AccountOpeningKycService accountOpeningKycService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.documentAnalysisService = documentAnalysisService;
        this.accountOpeningKycService = accountOpeningKycService;
    }
    
    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {}
    
    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 100) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8) String password,
            @NotBlank String fullName,
            String cpf,
            String phone,
            String documentFrontImage,
            String documentBackImage,
            String faceImage,
            String biometricChallenge
    ) {}
    
    public record AuthResponse(
            String token,
            String username,
            String email,
            String fullName,
            String accountNumber,
            Long balance,
            Set<String> roles
    ) {}
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            
            UserDetails userDetails = userDetailsService.loadUserByUsername(request.username());
            String token = jwtService.generateToken(userDetails);
            
            String normalizedLoginDocument = normalizeDocument(request.username());
            UserEntity user = userRepository.findByUsername(request.username())
                    .or(() -> userRepository.findByEmail(request.username()))
                    .or(() -> normalizedLoginDocument != null && normalizedLoginDocument.length() == 11
                            ? userRepository.findByCpf(normalizedLoginDocument)
                            : java.util.Optional.empty())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            Set<String> roles = user.getRoles().stream()
                    .map(RoleEntity::getName)
                    .collect(Collectors.toSet());
            
            return ResponseEntity.ok(new AuthResponse(
                    token,
                    user.getUsername(),
                    user.getEmail(),
                    user.getFullName(),
                    user.getAccountNumber(),
                    user.getBalance(),
                    roles
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid username or password");
        }
    }
    
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest request) {
        String normalizedCpf = normalizeDocument(request.cpf());
        if (normalizedCpf == null || normalizedCpf.length() != 11) {
            return ResponseEntity.badRequest().body("Informe CPF com 11 digitos para abertura de conta.");
        }
        AccountOpeningKycService.KycPayload kycPayload = new AccountOpeningKycService.KycPayload(
                request.documentFrontImage(),
                request.documentBackImage(),
                request.faceImage(),
                request.biometricChallenge()
        );

        try {
            accountOpeningKycService.validatePayload(kycPayload);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }

        // Validate password strength
        if (!PasswordValidator.isValid(request.password())) {
            return ResponseEntity.badRequest().body(PasswordValidator.getRequirements());
        }
        
        // Validate unique fields
        if (userRepository.existsByUsername(request.username())) {
            return ResponseEntity.badRequest().body("Username already exists");
        }
        if (userRepository.existsByEmail(request.email())) {
            return ResponseEntity.badRequest().body("Email already exists");
        }
        if (normalizedCpf != null
                && (userRepository.existsByCpf(normalizedCpf) || userRepository.existsByCpf(request.cpf()))) {
            return ResponseEntity.badRequest().body("CPF already registered");
        }
        
        // Generate unique account number
        String accountNumber = generateAccountNumber();
        
        // Create user
        UserEntity user = new UserEntity();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setCpf(normalizedCpf);
        user.setPhone(request.phone());
        user.setAccountNumber(accountNumber);
        user.setBalance(0L);
        user.setIsActive(true);
        
        // Assign USER role
        RoleEntity userRole = roleRepository.findByName("ROLE_USER")
                .orElseThrow(() -> new RuntimeException("Role not found"));
        Set<RoleEntity> roles = new HashSet<>();
        roles.add(userRole);
        user.setRoles(roles);
        
        user = userRepository.save(user);

        DocumentAnalysisEntity analysis = documentAnalysisService.analyzeForUser(user);
        accountOpeningKycService.storeForUser(user, kycPayload, "CPF", normalizedCpf);
        user.setStatusKyc(statusForAccountOpening(analysis));
        user = userRepository.save(user);
        
        // Generate token
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String token = jwtService.generateToken(userDetails);
        
        Set<String> roleNames = user.getRoles().stream()
                .map(RoleEntity::getName)
                .collect(Collectors.toSet());
        
        return ResponseEntity.ok(new AuthResponse(
                token,
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getAccountNumber(),
                user.getBalance(),
                roleNames
        ));
    }
    
    private String generateAccountNumber() {
        String accountNumber;
        do {
            // Generate cryptographically secure random account number
            long randomNumber = Math.abs(secureRandom.nextLong()) % 10000000000L;
            accountNumber = String.format("%010d", randomNumber);
        } while (userRepository.existsByAccountNumber(accountNumber));
        return accountNumber;
    }

    private String normalizeDocument(String value) {
        if (value == null || value.isBlank()) return null;
        String digits = value.replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    private String statusForAccountOpening(DocumentAnalysisEntity analysis) {
        if (analysis == null) return "EM_ANALISE_BIOMETRIA";
        if ("BAIXO".equals(analysis.getRiskLevel())) return "VERIFICADO";
        if ("MEDIO".equals(analysis.getRiskLevel())) return "EM_ANALISE_BIOMETRIA";
        return "BLOQUEADO_ANALISE";
    }
}
