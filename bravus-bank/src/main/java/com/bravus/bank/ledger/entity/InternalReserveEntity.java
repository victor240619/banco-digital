package com.bravus.bank.ledger.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "internal_reserves")
public class InternalReserveEntity {

    @Version
    private Long version;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String codigo;

    @Column(nullable = false)
    private String nome;

    @Column(name = "valor_total", nullable = false)
    private Long valorTotal;

    @Column(name = "valor_alocado", nullable = false)
    private Long valorAlocado = 0L;

    @Column(name = "valor_disponivel", nullable = false)
    private Long valorDisponivel;

    private String finalidade;

    @Column(name = "ledger_account_codigo", nullable = false, length = 20)
    private String ledgerAccountCodigo;

    @Column(nullable = false)
    private Boolean ativa = true;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = OffsetDateTime.now(); updatedAt = createdAt; }
    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public String getNome() { return nome; }
    public Long getValorTotal() { return valorTotal; }
    public Long getValorAlocado() { return valorAlocado; }
    public void setValorAlocado(Long v) { this.valorAlocado = v; }
    public Long getValorDisponivel() { return valorDisponivel; }
    public void setValorDisponivel(Long v) { this.valorDisponivel = v; }
    public String getFinalidade() { return finalidade; }
    public String getLedgerAccountCodigo() { return ledgerAccountCodigo; }
    public Boolean getAtiva() { return ativa; }
    public Long getVersion() { return version; }
}
