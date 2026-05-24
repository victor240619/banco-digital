package com.bravus.bank.ledger.entity;

import com.bravus.bank.db.entity.UserEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "credit_grants")
public class CreditGrantEntity {

    @Version
    private Long version;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "internal_reserve_id")
    private InternalReserveEntity internalReserve;

    @Column(name = "valor_concedido", nullable = false)
    private Long valorConcedido;

    @Column(name = "valor_disponivel", nullable = false)
    private Long valorDisponivel;

    @Column(name = "valor_usado", nullable = false)
    private Long valorUsado = 0L;

    @Column(name = "valor_liquidado", nullable = false)
    private Long valorLiquidado = 0L;

    @Column(name = "valor_inadimplente", nullable = false)
    private Long valorInadimplente = 0L;

    @Column(nullable = false, length = 20)
    private String status = "ATIVO";

    @Column(name = "motivo_concessao", columnDefinition = "TEXT")
    private String motivoConcessao;

    @Column(name = "regra_elegibilidade", columnDefinition = "TEXT")
    private String regraElegibilidade;

    @Column(name = "taxa_juros_anual", precision = 5, scale = 2)
    private BigDecimal taxaJurosAnual = BigDecimal.ZERO;

    @Column(name = "data_concessao", nullable = false)
    private OffsetDateTime dataConcessao;

    @Column(name = "data_vencimento")
    private OffsetDateTime dataVencimento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aprovado_por")
    private UserEntity aprovadoPor;

    @Column(name = "ledger_entry_id")
    private Long ledgerEntryId;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
        if (dataConcessao == null) dataConcessao = createdAt;
    }

    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public Long getId() { return id; }
    public UserEntity getUser() { return user; }
    public void setUser(UserEntity u) { this.user = u; }
    public InternalReserveEntity getInternalReserve() { return internalReserve; }
    public void setInternalReserve(InternalReserveEntity r) { this.internalReserve = r; }
    public Long getValorConcedido() { return valorConcedido; }
    public void setValorConcedido(Long v) { this.valorConcedido = v; }
    public Long getValorDisponivel() { return valorDisponivel; }
    public void setValorDisponivel(Long v) { this.valorDisponivel = v; }
    public Long getValorUsado() { return valorUsado; }
    public void setValorUsado(Long v) { this.valorUsado = v; }
    public Long getValorLiquidado() { return valorLiquidado; }
    public void setValorLiquidado(Long v) { this.valorLiquidado = v; }
    public Long getValorInadimplente() { return valorInadimplente; }
    public void setValorInadimplente(Long v) { this.valorInadimplente = v; }
    public String getStatus() { return status; }
    public void setStatus(String s) { this.status = s; }
    public String getMotivoConcessao() { return motivoConcessao; }
    public void setMotivoConcessao(String m) { this.motivoConcessao = m; }
    public String getRegraElegibilidade() { return regraElegibilidade; }
    public void setRegraElegibilidade(String r) { this.regraElegibilidade = r; }
    public BigDecimal getTaxaJurosAnual() { return taxaJurosAnual; }
    public void setTaxaJurosAnual(BigDecimal t) { this.taxaJurosAnual = t; }
    public OffsetDateTime getDataConcessao() { return dataConcessao; }
    public void setDataConcessao(OffsetDateTime d) { this.dataConcessao = d; }
    public OffsetDateTime getDataVencimento() { return dataVencimento; }
    public void setDataVencimento(OffsetDateTime d) { this.dataVencimento = d; }
    public UserEntity getAprovadoPor() { return aprovadoPor; }
    public void setAprovadoPor(UserEntity u) { this.aprovadoPor = u; }
    public Long getLedgerEntryId() { return ledgerEntryId; }
    public void setLedgerEntryId(Long id) { this.ledgerEntryId = id; }
    public String getObservacoes() { return observacoes; }
    public void setObservacoes(String o) { this.observacoes = o; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
