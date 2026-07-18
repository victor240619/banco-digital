package com.bravus.bank.auth;

import com.bravus.bank.compliance.AccountOpeningKycService;
import com.bravus.bank.compliance.DocumentAnalysisEntity;
import com.bravus.bank.compliance.DocumentAnalysisService;
import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.RoleRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
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
    private final AccessCredentialVerifier accessCredentialVerifier;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final DocumentAnalysisService documentAnalysisService;
    private final AccountOpeningKycService accountOpeningKycService;
    private final SecureRandom secureRandom = new SecureRandom();
    
    public AuthController(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            AccessCredentialVerifier accessCredentialVerifier,
            JwtService jwtService,
            UserDetailsService userDetailsService,
            DocumentAnalysisService documentAnalysisService,
            AccountOpeningKycService accountOpeningKycService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.accessCredentialVerifier = accessCredentialVerifier;
        this.jwtService = jwtService;
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
            @NotBlank @Size(min = 8, max = 64) String password,
            @NotBlank @Size(min = 8, max = 8) String numericPassword,
            @NotBlank String fullName,
            String cpf,
            String phone,
            String documentFrontImage,
            String documentBackImage,
            String faceImage,
            String biometricChallenge,
            String clientChannel
    ) {}

    public record RegistrationAvailabilityRequest(
            String username,
            String email,
            String cpf,
            String clientChannel
    ) {}

    public record RegistrationAvailabilityResponse(
            boolean available,
            boolean accountExists,
            String code,
            String message
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
            String normalizedLoginDocument = normalizeDocument(request.username());
            UserEntity user = userRepository.findByUsername(request.username())
                    .or(() -> userRepository.findByEmail(request.username()))
                    .or(() -> normalizedLoginDocument != null && normalizedLoginDocument.length() == 11
                            ? userRepository.findByCpf(normalizedLoginDocument)
                            : java.util.Optional.empty())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            if (!Boolean.TRUE.equals(user.getIsActive()) || !accessCredentialVerifier.matches(user, request.password())) {
                throw new RuntimeException("Invalid credentials");
            }
            UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
            String token = jwtService.generateToken(userDetails, user.getCredentialsVersion());
            
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
    @Transactional
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest request,
                                      @RequestHeader(value = "X-Bravus-Client", required = false) String bravusClient) {
        if (!isAllowedRegistrationClient(request, bravusClient)) {
            return ResponseEntity.status(403)
                    .body("Canal de abertura de conta nao autorizado.");
        }
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

        if (!RegistrationCredentialPolicy.isValidAlphanumericPassword(request.password())) {
            return ResponseEntity.badRequest().body("A senha alfanumerica deve ter de 8 a 64 caracteres, com letra maiuscula, minuscula e numero.");
        }
        if (!RegistrationCredentialPolicy.isValidNumericPassword(request.numericPassword())) {
            return ResponseEntity.badRequest().body("A senha numerica deve conter exatamente 8 digitos.");
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
        String accountNumber = generateAccountNumber();
        
        // Create user
        UserEntity user = new UserEntity();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setNumericAccessPassword(passwordEncoder.encode(request.numericPassword()));
        user.setFullName(request.fullName());
        user.setCpf(normalizedCpf);
        user.setPhone(request.phone());
        user.setAccountNumber(accountNumber);
        user.setBalance(0L);
        user.setIsActive(true);
        user.setOutboundOperationsEnabled(false);
        
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
        String token = jwtService.generateToken(userDetails, user.getCredentialsVersion());
        
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
    
    @PostMapping("/register/availability")
    public ResponseEntity<RegistrationAvailabilityResponse> registrationAvailability(
            @RequestBody RegistrationAvailabilityRequest request) {
        String normalizedCpf = normalizeDocument(request.cpf());
        if (normalizedCpf != null && normalizedCpf.length() == 11 && userRepository.existsByCpf(normalizedCpf)) {
            return ResponseEntity.ok(new RegistrationAvailabilityResponse(false, true,
                    "ACCOUNT_ALREADY_EXISTS", "Ja existe uma conta vinculada a este CPF."));
        }
        if (request.username() != null && !request.username().isBlank()
                && userRepository.existsByUsername(request.username().trim().toLowerCase())) {
            return ResponseEntity.ok(new RegistrationAvailabilityResponse(false, false,
                    "USERNAME_ALREADY_EXISTS", "Este nome de usuario ja esta em uso."));
        }
        if (request.email() != null && !request.email().isBlank()
                && userRepository.existsByEmail(request.email().trim().toLowerCase())) {
            return ResponseEntity.ok(new RegistrationAvailabilityResponse(false, false,
                    "EMAIL_ALREADY_EXISTS", "Este e-mail ja esta em uso."));
        }
        return ResponseEntity.ok(new RegistrationAvailabilityResponse(true, false,
                "AVAILABLE", "Dados disponiveis para abertura da conta."));
    }

    private String generateAccountNumber() {
        int start = secureRandom.nextInt(999_999) + 1;
        for (int offset = 0; offset < 999_999; offset++) {
            int number = 1 + ((start - 1 + offset) % 999_999);
            String candidate = String.format("%06d", number);
            if (!userRepository.existsByCurrentOrLegacyAccountNumber(candidate)) return candidate;
        }
        throw new IllegalStateException("Nao ha numeros de conta de 6 digitos disponiveis.");
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

    private boolean isAllowedRegistrationClient(RegisterRequest request, String bravusClient) {
        if ((bravusClient == null || bravusClient.isBlank())
                && "WEB".equalsIgnoreCase(request.clientChannel())) {
            return true;
        }
        if ("android-apk".equalsIgnoreCase(bravusClient)
                && "ANDROID_APK".equalsIgnoreCase(request.clientChannel())) {
            return true;
        }
        if ("ios-app".equalsIgnoreCase(bravusClient)
                && "IOS_APP".equalsIgnoreCase(request.clientChannel())) {
            return true;
        }
        return "mobile-app".equalsIgnoreCase(bravusClient)
                && "MOBILE_APP".equalsIgnoreCase(request.clientChannel());
    }
}
