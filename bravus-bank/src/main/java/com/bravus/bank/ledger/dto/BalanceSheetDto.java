package com.bravus.bank.ledger.dto;

import java.util.List;

public class BalanceSheetDto {

    public List<AccountLine> ativo;
    public List<AccountLine> passivo;
    public List<AccountLine> patrimonio;
    public List<AccountLine> receitas;
    public List<AccountLine> despesas;

    public Long totalAtivo;
    public Long totalPassivo;
    public Long totalPatrimonio;

    public ReserveSummary reservaMestre;
    public List<InternalReserveLine> reservasInternas;

    public ChainSummary cadeia;

    public boolean balanceado;       // ativo == passivo + patrimonio?

    public static class AccountLine {
        public String codigo;
        public String nome;
        public String tipo;
        public String natureza;
        public Long saldo;            // centavos
        public AccountLine(String c, String n, String t, String nat, Long s) {
            this.codigo = c; this.nome = n; this.tipo = t; this.natureza = nat; this.saldo = s;
        }
    }

    public static class ReserveSummary {
        public String nome;
        public Long totalCapital;
        public Long totalEmitido;
        public Long totalEmCirculacao;
        public Long totalLiquidado;
        public Long totalInadimplente;
        public Integer fatorMultiplicador;
        public Long capacidadeTotalEmissao;
        public Long disponivelEmissao;       // capacidadeTotal - emitido
        public Double percentualUtilizado;   // emitido/capacidadeTotal * 100
        public String status;
        public String moeda;
    }

    public static class InternalReserveLine {
        public String codigo;
        public String nome;
        public Long valorTotal;
        public Long valorAlocado;
        public Long valorDisponivel;
        public String finalidade;
        public InternalReserveLine(String c, String n, Long t, Long a, Long d, String f) {
            this.codigo = c; this.nome = n; this.valorTotal = t;
            this.valorAlocado = a; this.valorDisponivel = d; this.finalidade = f;
        }
    }

    public static class ChainSummary {
        public Long totalLancamentos;
        public Long ultimaSequencia;
        public String hashGenesis;
        public String hashHead;
        public boolean integra;
        public String mensagem;
    }
}
