package com.bravus.bank.ledger.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "ledger_entries")
public class LedgerEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private Long sequencia;

    @Column(nullable = false)
    private OffsetDateTime data;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descricao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "debito_conta_id", nullable = false)
    private LedgerAccountEntity debitoConta;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credito_conta_id", nullable = false)
    private LedgerAccountEntity creditoConta;

    @Column(nullable = false)
    private Long valor;

    @Column(nullable = false, length = 30)
    private String tipo;

    @Column(name = "referencia_id")
    private Long referenciaId;

    @Column(name = "referencia_tipo", length = 50)
    private String referenciaTipo;

    @Column(nullable = false, length = 64, unique = true)
    private String hash;

    @Column(name = "hash_anterior", nullable = false, length = 64)
    private String hashAnterior;

    @Column(nullable = false, length = 20)
    private String status = "CONFIRMADO";

    @Column(name = "criado_por", nullable = false, length = 100)
    private String criadoPor = "SYSTEM";

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (data == null) data = createdAt;
    }

    public Long getId() { return id; }
    public Long getSequencia() { return sequencia; }
    public void setSequencia(Long s) { this.sequencia = s; }
    public OffsetDateTime getData() { return data; }
    public void setData(OffsetDateTime d) { this.data = d; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String d) { this.descricao = d; }
    public LedgerAccountEntity getDebitoConta() { return debitoConta; }
    public void setDebitoConta(LedgerAccountEntity c) { this.debitoConta = c; }
    public LedgerAccountEntity getCreditoConta() { return creditoConta; }
    public void setCreditoConta(LedgerAccountEntity c) { this.creditoConta = c; }
    public Long getValor() { return valor; }
    public void setValor(Long v) { this.valor = v; }
    public String getTipo() { return tipo; }
    public void setTipo(String t) { this.tipo = t; }
    public Long getReferenciaId() { return referenciaId; }
    public void setReferenciaId(Long r) { this.referenciaId = r; }
    public String getReferenciaTipo() { return referenciaTipo; }
    public void setReferenciaTipo(String r) { this.referenciaTipo = r; }
    public String getHash() { return hash; }
    public void setHash(String h) { this.hash = h; }
    public String getHashAnterior() { return hashAnterior; }
    public void setHashAnterior(String h) { this.hashAnterior = h; }
    public String getStatus() { return status; }
    public void setStatus(String s) { this.status = s; }
    public String getCriadoPor() { return criadoPor; }
    public void setCriadoPor(String c) { this.criadoPor = c; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String o) { this.observacao = o; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
