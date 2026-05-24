package com.bravus.bank.ledger.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "bank_reserve")
public class BankReserveEntity {

    @Version
    private Long version;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "total_capital", nullable = false)
    private Long totalCapital;

    @Column(name = "total_emitido", nullable = false)
    private Long totalEmitido = 0L;

    @Column(name = "total_em_circulacao", nullable = false)
    private Long totalEmCirculacao = 0L;

    @Column(name = "total_liquidado", nullable = false)
    private Long totalLiquidado = 0L;

    @Column(name = "total_inadimplente", nullable = false)
    private Long totalInadimplente = 0L;

    @Column(name = "saldo_disponivel_emissao", nullable = false)
    private Long saldoDisponivelEmissao;

    @Column(name = "fator_multiplicador", nullable = false)
    private Integer fatorMultiplicador = 10;

    @Column(name = "capacidade_total_emissao", nullable = false)
    private Long capacidadeTotalEmissao;

    @Column(nullable = false, length = 3)
    private String moeda = "BRL";

    @Column(nullable = false, length = 20)
    private String status = "ATIVA";

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = OffsetDateTime.now(); updatedAt = createdAt; }
    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public Long getId() { return id; }
    public String getNome() { return nome; }
    public Long getTotalCapital() { return totalCapital; }
    public Long getTotalEmitido() { return totalEmitido; }
    public void setTotalEmitido(Long v) { this.totalEmitido = v; }
    public Long getTotalEmCirculacao() { return totalEmCirculacao; }
    public void setTotalEmCirculacao(Long v) { this.totalEmCirculacao = v; }
    public Long getTotalLiquidado() { return totalLiquidado; }
    public void setTotalLiquidado(Long v) { this.totalLiquidado = v; }
    public Long getTotalInadimplente() { return totalInadimplente; }
    public void setTotalInadimplente(Long v) { this.totalInadimplente = v; }
    public Long getSaldoDisponivelEmissao() { return saldoDisponivelEmissao; }
    public void setSaldoDisponivelEmissao(Long v) { this.saldoDisponivelEmissao = v; }
    public Integer getFatorMultiplicador() { return fatorMultiplicador; }
    public Long getCapacidadeTotalEmissao() { return capacidadeTotalEmissao; }
    public String getMoeda() { return moeda; }
    public String getStatus() { return status; }
    public void setStatus(String s) { this.status = s; }
    public Long getVersion() { return version; }
}
