package com.bravus.bank.db.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class UserEntity {

    @Version
    private Long version;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(unique = true)
    private String cpf;

    private String phone;

    @Column(nullable = false)
    private Long balance = 0L;

    @Column(name = "account_number", unique = true, nullable = false)
    private String accountNumber;

    @Column(name = "account_type")
    private String accountType = "CORRENTE";

    @Column(name = "is_active")
    private Boolean isActive = true;

    // === Dados bancários ===
    private String agencia = "0001";

    @Column(name = "codigo_banco")
    private String codigoBanco = "999";

    @Column(name = "nome_banco")
    private String nomeBanco = "Bravus Premium Bank";

    private String ispb = "99999999";

    @Column(name = "chave_pix")
    private String chavePix;

    @Column(name = "tipo_chave_pix")
    private String tipoChavePix = "CPF";

    // === Dados pessoais ===
    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Column(name = "nome_mae")
    private String nomeMae;

    // === Endereço ===
    @Column(name = "endereco_cep")     private String enderecoCep;
    @Column(name = "endereco_rua")     private String enderecoRua;
    @Column(name = "endereco_numero")  private String enderecoNumero;
    @Column(name = "endereco_cidade")  private String enderecoCidade;
    @Column(name = "endereco_uf")      private String enderecoUf;

    private String profissao;

    @Column(name = "renda_mensal")
    private Long rendaMensal = 0L;

    @Column(name = "status_kyc")
    private String statusKyc = "VERIFICADO";

    @Column(name = "nivel_conta")
    private String nivelConta = "PREMIUM";

    @Column(name = "limite_credito")
    private Long limiteCredito = 0L;

    @Column(name = "limite_pix_diario")
    private Long limitePixDiario = 1000000L; // R$ 10.000,00

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<RoleEntity> roles = new HashSet<>();

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (updatedAt == null) updatedAt = OffsetDateTime.now();
        // Auto-gera chave PIX baseada no CPF se não foi setada
        if ((chavePix == null || chavePix.isBlank()) && cpf != null) {
            chavePix = cpf.replaceAll("[^0-9]", "");
            tipoChavePix = "CPF";
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ===== Getters/Setters =====
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getCpf() { return cpf; }
    public void setCpf(String cpf) { this.cpf = cpf; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public Long getBalance() { return balance; }
    public void setBalance(Long balance) { this.balance = balance; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getAccountType() { return accountType; }
    public void setAccountType(String accountType) { this.accountType = accountType; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public String getAgencia() { return agencia; }
    public void setAgencia(String agencia) { this.agencia = agencia; }

    public String getCodigoBanco() { return codigoBanco; }
    public void setCodigoBanco(String codigoBanco) { this.codigoBanco = codigoBanco; }

    public String getNomeBanco() { return nomeBanco; }
    public void setNomeBanco(String nomeBanco) { this.nomeBanco = nomeBanco; }

    public String getIspb() { return ispb; }
    public void setIspb(String ispb) { this.ispb = ispb; }

    public String getChavePix() { return chavePix; }
    public void setChavePix(String chavePix) { this.chavePix = chavePix; }

    public String getTipoChavePix() { return tipoChavePix; }
    public void setTipoChavePix(String tipoChavePix) { this.tipoChavePix = tipoChavePix; }

    public LocalDate getDataNascimento() { return dataNascimento; }
    public void setDataNascimento(LocalDate dataNascimento) { this.dataNascimento = dataNascimento; }

    public String getNomeMae() { return nomeMae; }
    public void setNomeMae(String nomeMae) { this.nomeMae = nomeMae; }

    public String getEnderecoCep() { return enderecoCep; }
    public void setEnderecoCep(String enderecoCep) { this.enderecoCep = enderecoCep; }

    public String getEnderecoRua() { return enderecoRua; }
    public void setEnderecoRua(String enderecoRua) { this.enderecoRua = enderecoRua; }

    public String getEnderecoNumero() { return enderecoNumero; }
    public void setEnderecoNumero(String enderecoNumero) { this.enderecoNumero = enderecoNumero; }

    public String getEnderecoCidade() { return enderecoCidade; }
    public void setEnderecoCidade(String enderecoCidade) { this.enderecoCidade = enderecoCidade; }

    public String getEnderecoUf() { return enderecoUf; }
    public void setEnderecoUf(String enderecoUf) { this.enderecoUf = enderecoUf; }

    public String getProfissao() { return profissao; }
    public void setProfissao(String profissao) { this.profissao = profissao; }

    public Long getRendaMensal() { return rendaMensal; }
    public void setRendaMensal(Long rendaMensal) { this.rendaMensal = rendaMensal; }

    public String getStatusKyc() { return statusKyc; }
    public void setStatusKyc(String statusKyc) { this.statusKyc = statusKyc; }

    public String getNivelConta() { return nivelConta; }
    public void setNivelConta(String nivelConta) { this.nivelConta = nivelConta; }

    public Long getLimiteCredito() { return limiteCredito; }
    public void setLimiteCredito(Long limiteCredito) { this.limiteCredito = limiteCredito; }

    public Long getLimitePixDiario() { return limitePixDiario; }
    public void setLimitePixDiario(Long limitePixDiario) { this.limitePixDiario = limitePixDiario; }

    public Set<RoleEntity> getRoles() { return roles; }
    public void setRoles(Set<RoleEntity> roles) { this.roles = roles; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
