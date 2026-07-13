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

            roleRepo.findByName("ROLE_USER").orElseGet(() -> {
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
            admin.setAccountNumber("0000000003");
            admin.setBalance(0L);
            admin.setIsActive(true);
            admin.setStatusKyc("APROVADO_AUTO");
            Set<RoleEntity> roles = new HashSet<>();
            roles.add(adminRole);
            admin.setRoles(roles);
            userRepo.save(admin);
        };
    }
}
