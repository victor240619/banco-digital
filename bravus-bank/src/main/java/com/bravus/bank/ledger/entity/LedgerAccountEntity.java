package com.bravus.bank.ledger.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "ledger_accounts")
public class LedgerAccountEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 20)
    private String codigo;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, length = 20)
    private String tipo; // ATIVO, PASSIVO, PATRIMONIO, RECEITA, DESPESA

    private String descricao;

    @Column(nullable = false, length = 10)
    private String natureza; // DEVEDORA, CREDORA

    @Column(nullable = false)
    private Long saldo = 0L;

    @Column(nullable = false)
    private Boolean ativa = true;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }

    // getters/setters
    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public String getNatureza() { return natureza; }
    public void setNatureza(String natureza) { this.natureza = natureza; }
    public Long getSaldo() { return saldo; }
    public void setSaldo(Long saldo) { this.saldo = saldo; }
    public Boolean getAtiva() { return ativa; }
    public void setAtiva(Boolean ativa) { this.ativa = ativa; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
