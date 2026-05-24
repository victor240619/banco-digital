package com.bravus.bank.ledger.service;

import com.bravus.bank.ledger.dto.BalanceSheetDto;
import com.bravus.bank.ledger.entity.BankReserveEntity;
import com.bravus.bank.ledger.entity.InternalReserveEntity;
import com.bravus.bank.ledger.entity.LedgerAccountEntity;
import com.bravus.bank.ledger.entity.LedgerEntryEntity;
import com.bravus.bank.ledger.repo.BankReserveRepository;
import com.bravus.bank.ledger.repo.InternalReserveRepository;
import com.bravus.bank.ledger.repo.LedgerAccountRepository;
import com.bravus.bank.ledger.repo.LedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class BalanceSheetService {

    private final LedgerAccountRepository accountRepo;
    private final BankReserveRepository bankReserveRepo;
    private final InternalReserveRepository internalReserveRepo;
    private final LedgerEntryRepository entryRepo;
    private final LedgerService ledgerService;

    public BalanceSheetService(LedgerAccountRepository accountRepo,
                               BankReserveRepository bankReserveRepo,
                               InternalReserveRepository internalReserveRepo,
                               LedgerEntryRepository entryRepo,
                               LedgerService ledgerService) {
        this.accountRepo = accountRepo;
        this.bankReserveRepo = bankReserveRepo;
        this.internalReserveRepo = internalReserveRepo;
        this.entryRepo = entryRepo;
        this.ledgerService = ledgerService;
    }

    @Transactional(readOnly = true)
    public BalanceSheetDto build() {
        BalanceSheetDto dto = new BalanceSheetDto();

        dto.ativo      = mapAccounts("ATIVO");
        dto.passivo    = mapAccounts("PASSIVO");
        dto.patrimonio = mapAccounts("PATRIMONIO");
        dto.receitas   = mapAccounts("RECEITA");
        dto.despesas   = mapAccounts("DESPESA");

        dto.totalAtivo      = sum(dto.ativo);
        dto.totalPassivo    = sum(dto.passivo);
        dto.totalPatrimonio = sum(dto.patrimonio);
        dto.balanceado = dto.totalAtivo.equals(dto.totalPassivo + dto.totalPatrimonio);

        // Reserva mestre
        Optional<BankReserveEntity> opt = bankReserveRepo.findMaster();
        if (opt.isPresent()) {
            BankReserveEntity m = opt.get();
            BalanceSheetDto.ReserveSummary rs = new BalanceSheetDto.ReserveSummary();
            rs.nome = m.getNome();
            rs.totalCapital = m.getTotalCapital();
            rs.totalEmitido = m.getTotalEmitido();
            rs.totalEmCirculacao = m.getTotalEmCirculacao();
            rs.totalLiquidado = m.getTotalLiquidado();
            rs.totalInadimplente = m.getTotalInadimplente();
            rs.fatorMultiplicador = m.getFatorMultiplicador();
            rs.capacidadeTotalEmissao = m.getCapacidadeTotalEmissao();
            rs.disponivelEmissao = m.getCapacidadeTotalEmissao() - m.getTotalEmitido();
            rs.percentualUtilizado = m.getCapacidadeTotalEmissao() > 0
                    ? (m.getTotalEmitido() * 100.0 / m.getCapacidadeTotalEmissao()) : 0.0;
            rs.status = m.getStatus();
            rs.moeda = m.getMoeda();
            dto.reservaMestre = rs;
        }

        // Reservas internas
        List<BalanceSheetDto.InternalReserveLine> linhas = new ArrayList<>();
        for (InternalReserveEntity ir : internalReserveRepo.findAll()) {
            linhas.add(new BalanceSheetDto.InternalReserveLine(
                    ir.getCodigo(), ir.getNome(),
                    ir.getValorTotal(), ir.getValorAlocado(),
                    ir.getValorDisponivel(), ir.getFinalidade()));
        }
        dto.reservasInternas = linhas;

        // Cadeia
        BalanceSheetDto.ChainSummary cs = new BalanceSheetDto.ChainSummary();
        Long maxSeq = entryRepo.findMaxSequencia();
        cs.totalLancamentos = (long) entryRepo.findAll().size();
        cs.ultimaSequencia = maxSeq != null ? maxSeq : 0L;

        List<LedgerEntryEntity> primeira = entryRepo.findAllByOrderBySequenciaAsc();
        if (!primeira.isEmpty()) {
            cs.hashGenesis = primeira.get(0).getHash();
            cs.hashHead = primeira.get(primeira.size() - 1).getHash();
        }
        LedgerService.ChainValidationResult v = ledgerService.validateChain();
        cs.integra = v.valida;
        cs.mensagem = v.mensagem;
        dto.cadeia = cs;

        return dto;
    }

    private List<BalanceSheetDto.AccountLine> mapAccounts(String tipo) {
        List<BalanceSheetDto.AccountLine> out = new ArrayList<>();
        for (LedgerAccountEntity a : accountRepo.findByTipoOrderByCodigo(tipo)) {
            out.add(new BalanceSheetDto.AccountLine(
                    a.getCodigo(), a.getNome(), a.getTipo(),
                    a.getNatureza(), a.getSaldo()));
        }
        return out;
    }

    private Long sum(List<BalanceSheetDto.AccountLine> lines) {
        return lines.stream().mapToLong(l -> l.saldo).sum();
    }
}
