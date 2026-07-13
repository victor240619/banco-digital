package com.bravus.bank.config;

import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.RoleRepository;
import com.bravus.bank.db.repo.UserRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.Set;

@Configuration
@Profile("local")
public class LocalDevDataConfig {
    private static final String ADMIN_LOGIN = "admin@bravusbank.com";
    private static final String ADMIN_PASSWORD = "6run0955";
    private static final String LEGACY_ADMIN_LOGIN = "admin_bravus";
    private static final String CUSTOMER_CPF = "05569161155";
    private static final String CUSTOMER_USERNAME = "joao.victor";
    private static final String CUSTOMER_EMAIL = "pulmaturcruzeiros@gmail.com";
    private static final String CUSTOMER_PASSWORD = "6run0955";
    private static final String CUSTOMER_ACCOUNT = "0556916115";

    @Bean
    ApplicationRunner seedLocalAdmin(RoleRepository roleRepo,
                                     UserRepository userRepo,
                                     PasswordEncoder passwordEncoder) {
        return args -> {
            RoleEntity adminRole = roleRepo.findByName("ROLE_ADMIN").orElseGet(() -> {
                RoleEntity role = new RoleEntity();
                role.setName("ROLE_ADMIN");
                role.setDescription("Administrador local");
                return roleRepo.save(role);
            });

            RoleEntity userRole = roleRepo.findByName("ROLE_USER").orElseGet(() -> {
                RoleEntity role = new RoleEntity();
                role.setName("ROLE_USER");
                role.setDescription("Usuario local");
                return roleRepo.save(role);
            });

            UserEntity admin = userRepo.findByUsername(ADMIN_LOGIN)
                    .orElseGet(() -> userRepo.findByEmail(ADMIN_LOGIN)
                            .orElseGet(() -> userRepo.findByUsername(LEGACY_ADMIN_LOGIN)
                                    .orElseGet(UserEntity::new)));

            admin.setUsername(ADMIN_LOGIN);
            admin.setEmail(ADMIN_LOGIN);
            admin.setPassword(passwordEncoder.encode(ADMIN_PASSWORD));
            admin.setFullName("Administrador Bravus Local");
            setAccountNumberIfAvailable(admin, userRepo, "0000000003");
            admin.setBalance(0L);
            admin.setIsActive(true);
            admin.setStatusKyc("APROVADO_AUTO");
            Set<RoleEntity> roles = new HashSet<>();
            roles.add(adminRole);
            admin.setRoles(roles);
            userRepo.save(admin);

            UserEntity customer = userRepo.findByCpf(CUSTOMER_CPF)
                    .orElseGet(() -> userRepo.findByEmail(CUSTOMER_EMAIL)
                            .orElseGet(() -> userRepo.findByUsername(CUSTOMER_USERNAME)
                                    .orElseGet(UserEntity::new)));

            customer.setUsername(CUSTOMER_USERNAME);
            customer.setEmail(CUSTOMER_EMAIL);
            customer.setPassword(passwordEncoder.encode(CUSTOMER_PASSWORD));
            customer.setFullName("Joao Victor Mendon\u00e7a Guimaraes");
            customer.setCpf(CUSTOMER_CPF);
            customer.setPhone("");
            setAccountNumberIfAvailable(customer, userRepo, CUSTOMER_ACCOUNT);
            customer.setBalance(0L);
            customer.setIsActive(true);
            customer.setStatusKyc("APROVADO_AUTO");
            customer.setNivelConta("PREMIUM");
            customer.setChavePix(CUSTOMER_CPF);
            customer.setTipoChavePix("CPF");
            Set<RoleEntity> customerRoles = new HashSet<>();
            customerRoles.add(userRole);
            customer.setRoles(customerRoles);
            userRepo.save(customer);
        };
    }

    private void setAccountNumberIfAvailable(UserEntity user, UserRepository userRepo, String accountNumber) {
        boolean takenByOther = userRepo.findByAccountNumber(accountNumber)
                .filter(existing -> user.getId() == null || !existing.getId().equals(user.getId()))
                .isPresent();
        if (!takenByOther) {
            user.setAccountNumber(accountNumber);
        } else if (user.getAccountNumber() == null || user.getAccountNumber().isBlank()) {
            throw new IllegalStateException("Account number already exists: " + accountNumber);
        }
    }
}
