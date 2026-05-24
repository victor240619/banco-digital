package com.bravus.bank.ledger.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "credit_usages")
public class CreditUsageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "credit_grant_id")
    private CreditGrantEntity creditGrant;

    @Column(name = "transaction_id")
    private Long transactionId;

    @Column(nullable = false)
    private Long valor;

    @Column(nullable = false, length = 30)
    private String tipo;

    @Column(name = "saldo_antes", nullable = false)
    private Long saldoAntes;

    @Column(name = "saldo_depois", nullable = false)
    private Long saldoDepois;

    @Column(name = "ledger_entry_id", nullable = false)
    private Long ledgerEntryId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = OffsetDateTime.now(); }

    public Long getId() { return id; }
    public CreditGrantEntity getCreditGrant() { return creditGrant; }
    public void setCreditGrant(CreditGrantEntity g) { this.creditGrant = g; }
    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long t) { this.transactionId = t; }
    public Long getValor() { return valor; }
    public void setValor(Long v) { this.valor = v; }
    public String getTipo() { return tipo; }
    public void setTipo(String t) { this.tipo = t; }
    public Long getSaldoAntes() { return saldoAntes; }
    public void setSaldoAntes(Long s) { this.saldoAntes = s; }
    public Long getSaldoDepois() { return saldoDepois; }
    public void setSaldoDepois(Long s) { this.saldoDepois = s; }
    public Long getLedgerEntryId() { return ledgerEntryId; }
    public void setLedgerEntryId(Long id) { this.ledgerEntryId = id; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
