package com.bravus.bank.config;

import com.bravus.bank.db.entity.RoleEntity;
import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.RoleRepository;
import com.bravus.bank.db.repo.UserRepository;
import com.bravus.bank.ledger.entity.CreditGrantEntity;
import com.bravus.bank.ledger.repo.CreditGrantRepository;
import com.bravus.bank.ledger.service.CreditService;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.OffsetDateTime;
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
    private static final long CUSTOMER_INITIAL_CREDIT_CENTAVOS = 89_000_000L;
    private static final BigDecimal CUSTOMER_INITIAL_CREDIT_ANNUAL_INTEREST = new BigDecimal("24.00");
    private static final String CUSTOMER_INITIAL_CREDIT_MARKER = "BRAVUS_LOCAL_JOAO_CREDIT_890000";
    private static final Path LOCAL_DATA_MARKER = Path.of("data", ".local-bank-protection.properties");

    @Bean
    ApplicationRunner seedLocalAdmin(RoleRepository roleRepo,
                                     UserRepository userRepo,
                                     PasswordEncoder passwordEncoder,
                                     CreditGrantRepository grantRepo,
                                     CreditService creditService,
                                     JdbcTemplate jdbcTemplate) {
        return args -> {
            LocalBankDataProtection dataProtection = new LocalBankDataProtection(LOCAL_DATA_MARKER);
            dataProtection.verifyCurrentCounts(jdbcTemplate);

            ensureLocalLedgerBase(jdbcTemplate);

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
            if (admin.getBalance() == null) {
                admin.setBalance(0L);
            }
            admin.setIsActive(true);
            admin.setOutboundOperationsEnabled(true);
            admin.setStatusKyc("APROVADO_AUTO");
            Set<RoleEntity> roles = new HashSet<>();
            roles.add(adminRole);
            admin.setRoles(roles);
            admin = userRepo.save(admin);

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
            if (customer.getBalance() == null) {
                customer.setBalance(0L);
            }
            customer.setIsActive(true);
            customer.setOutboundOperationsEnabled(true);
            customer.setStatusKyc("APROVADO_AUTO");
            customer.setNivelConta("PREMIUM");
            customer.setChavePix(CUSTOMER_CPF);
            customer.setTipoChavePix("CPF");
            Set<RoleEntity> customerRoles = new HashSet<>();
            customerRoles.add(userRole);
            customer.setRoles(customerRoles);
            customer = userRepo.save(customer);

            ensureJoaoInitialCredit(customer, admin, grantRepo, creditService);
            dataProtection.rememberCurrentCounts(jdbcTemplate);
        };
    }

    private void ensureLocalLedgerBase(JdbcTemplate jdbc) {
        ensureLedgerAccount(jdbc, "1.1.2.1", "Reserva Alocada - Credito Pessoal", "ATIVO", "DEVEDORA",
                "Sub-caixa de credito pessoal.");
        ensureLedgerAccount(jdbc, "1.2.1", "Creditos Concedidos a Clientes", "ATIVO", "DEVEDORA",
                "Creditos escriturais concedidos.");
        ensureLedgerAccount(jdbc, "1.2.2", "Creditos em Uso", "ATIVO", "DEVEDORA",
                "Creditos utilizados em transacoes.");
        ensureLedgerAccount(jdbc, "2.1.1", "Obrigacoes Escriturais", "PASSIVO", "CREDORA",
                "Obrigacoes do banco perante clientes.");

        Integer masterCount = jdbc.queryForObject("SELECT COUNT(*) FROM bank_reserve", Integer.class);
        if (masterCount == null || masterCount == 0) {
            jdbc.update("""
                    INSERT INTO bank_reserve (
                        nome, total_capital, total_emitido, total_em_circulacao,
                        total_liquidado, total_inadimplente, saldo_disponivel_emissao,
                        fator_multiplicador, capacidade_total_emissao, moeda, status, version
                    ) VALUES (?, ?, 0, 0, 0, 0, ?, 10, ?, 'BRL', 'ATIVA', 0)
                    """,
                    "Reserva Mestre Bravus Bank",
                    70_000_000_000L,
                    700_000_000_000L,
                    700_000_000_000L);
        }
        jdbc.update("UPDATE bank_reserve SET version = 0 WHERE version IS NULL");

        Integer reserveCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM internal_reserves WHERE codigo = 'CREDITO_PESSOAL'",
                Integer.class);
        if (reserveCount == null || reserveCount == 0) {
            jdbc.update("""
                    INSERT INTO internal_reserves (
                        codigo, nome, valor_total, valor_alocado, valor_disponivel,
                        finalidade, ledger_account_codigo, ativa, version
                    ) VALUES (?, ?, ?, 0, ?, ?, ?, TRUE, 0)
                    """,
                    "CREDITO_PESSOAL",
                    "Reserva de Credito Pessoal",
                    20_000_000_000L,
                    20_000_000_000L,
                    "Credito pessoal para clientes pessoa fisica",
                    "1.1.2.1");
        }
        jdbc.update("UPDATE internal_reserves SET version = 0 WHERE version IS NULL");
    }

    private void ensureLedgerAccount(JdbcTemplate jdbc,
                                     String codigo,
                                     String nome,
                                     String tipo,
                                     String natureza,
                                     String descricao) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM ledger_accounts WHERE codigo = ?",
                Integer.class,
                codigo);
        if (count != null && count > 0) {
            return;
        }
        jdbc.update("""
                INSERT INTO ledger_accounts (codigo, nome, tipo, natureza, descricao, saldo, ativa)
                VALUES (?, ?, ?, ?, ?, 0, TRUE)
                """,
                codigo, nome, tipo, natureza, descricao);
    }

    private void ensureJoaoInitialCredit(UserEntity customer,
                                         UserEntity admin,
                                         CreditGrantRepository grantRepo,
                                         CreditService creditService) {
        CreditGrantEntity existing = grantRepo.findByUserIdOrderByDataConcessaoDesc(customer.getId())
                .stream()
                .filter(this::isJoaoInitialCredit)
                .findFirst()
                .orElse(null);
        if (existing != null) {
            ensureJoaoCreditInterest(existing, grantRepo);
            return;
        }

        CreditService.GrantCommand cmd = new CreditService.GrantCommand();
        cmd.userId = customer.getId();
        cmd.aprovadoPorId = admin.getId();
        cmd.reservaCodigo = "CREDITO_PESSOAL";
        cmd.valor = CUSTOMER_INITIAL_CREDIT_CENTAVOS;
        cmd.motivo = "Credito escritural inicial para Joao Victor";
        cmd.regraElegibilidade = CUSTOMER_INITIAL_CREDIT_MARKER;
        cmd.taxaJurosAnual = CUSTOMER_INITIAL_CREDIT_ANNUAL_INTEREST;
        cmd.dataVencimento = OffsetDateTime.now().plusYears(5);
        cmd.observacoes = "Credito liberado no livro razao local; cliente passa a dever ao banco o valor concedido, com juros anuais de "
                + CUSTOMER_INITIAL_CREDIT_ANNUAL_INTEREST + "%.";
        creditService.grantCredit(cmd);
    }

    private void ensureJoaoCreditInterest(CreditGrantEntity grant, CreditGrantRepository grantRepo) {
        BigDecimal current = grant.getTaxaJurosAnual();
        if (current != null && current.compareTo(BigDecimal.ZERO) > 0) {
            return;
        }
        grant.setTaxaJurosAnual(CUSTOMER_INITIAL_CREDIT_ANNUAL_INTEREST);
        String notes = grant.getObservacoes();
        String suffix = " Juros anuais atualizados para " + CUSTOMER_INITIAL_CREDIT_ANNUAL_INTEREST + "%.";
        grant.setObservacoes(notes == null || notes.isBlank() ? suffix.trim() : notes + suffix);
        grantRepo.save(grant);
    }

    private boolean isJoaoInitialCredit(CreditGrantEntity grant) {
        if (CUSTOMER_INITIAL_CREDIT_MARKER.equals(grant.getRegraElegibilidade())) {
            return true;
        }
        if (CUSTOMER_INITIAL_CREDIT_CENTAVOS == (grant.getValorConcedido() == null ? 0L : grant.getValorConcedido())
                && "ATIVO".equals(grant.getStatus())) {
            return true;
        }
        String notes = grant.getObservacoes();
        return notes != null && notes.contains(CUSTOMER_INITIAL_CREDIT_MARKER);
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
