package com.bravus.bank.user;

import com.bravus.bank.db.entity.UserEntity;
import com.bravus.bank.db.repo.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Endpoint /api/user/me — retorna TODOS os dados bancários do usuário autenticado.
 * Usado pelo dashboard pra mostrar agência, conta, banco, chave PIX, status KYC, etc.
 */
@RestController
@RequestMapping("/api/user")
public class MeController {

    private final UserRepository userRepository;

    public MeController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        UserEntity u = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", u.getId());
        out.put("username", u.getUsername());
        out.put("email", u.getEmail());
        out.put("fullName", u.getFullName());
        out.put("cpf", u.getCpf());
        out.put("phone", u.getPhone());
        out.put("phoneFormatted", formatPhone(u.getPhone()));

        // Dados bancários
        Map<String, Object> banco = new LinkedHashMap<>();
        banco.put("nomeBanco", u.getNomeBanco());
        banco.put("codigoBanco", u.getCodigoBanco());
        banco.put("ispb", u.getIspb());
        banco.put("agencia", u.getAgencia());
        banco.put("conta", u.getAccountNumber());
        banco.put("contaFormatada", formatAccount(u.getAccountNumber()));
        banco.put("tipoConta", u.getAccountType());
        banco.put("chavePix", u.getChavePix());
        banco.put("tipoChavePix", u.getTipoChavePix());
        out.put("dadosBancarios", banco);

        // Saldos e limites
        Map<String, Object> saldos = new LinkedHashMap<>();
        long balance = u.getBalance() == null ? 0 : u.getBalance();
        long limite = u.getLimiteCredito() == null ? 0 : u.getLimiteCredito();
        saldos.put("saldoDisponivelCentavos", balance);
        saldos.put("saldoDisponivel", balance / 100.0);
        saldos.put("limiteCreditoCentavos", limite);
        saldos.put("limiteCredito", limite / 100.0);
        saldos.put("limitePixDiarioCentavos", u.getLimitePixDiario());
        saldos.put("limitePixDiario", u.getLimitePixDiario() == null ? 0 : u.getLimitePixDiario() / 100.0);
        saldos.put("totalDisponivelCentavos", balance + limite);
        saldos.put("totalDisponivel", (balance + limite) / 100.0);
        out.put("saldos", saldos);

        // Conta / KYC
        Map<String, Object> conta = new LinkedHashMap<>();
        conta.put("nivel", u.getNivelConta());
        conta.put("statusKyc", u.getStatusKyc());
        conta.put("ativa", u.getIsActive());
        conta.put("abertura", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
        out.put("conta", conta);

        // Endereço
        Map<String, Object> endereco = new LinkedHashMap<>();
        endereco.put("cep", u.getEnderecoCep());
        endereco.put("rua", u.getEnderecoRua());
        endereco.put("numero", u.getEnderecoNumero());
        endereco.put("cidade", u.getEnderecoCidade());
        endereco.put("uf", u.getEnderecoUf());
        out.put("endereco", endereco);

        out.put("dataNascimento", u.getDataNascimento());
        out.put("nomeMae", u.getNomeMae());
        out.put("profissao", u.getProfissao());

        out.put("roles", u.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList()));

        return ResponseEntity.ok(out);
    }

    private String formatPhone(String phone) {
        if (phone == null) return null;
        String d = phone.replaceAll("[^0-9]", "");
        if (d.length() == 11) {
            return "(" + d.substring(0,2) + ") " + d.substring(2,7) + "-" + d.substring(7);
        }
        if (d.length() == 10) {
            return "(" + d.substring(0,2) + ") " + d.substring(2,6) + "-" + d.substring(6);
        }
        return phone;
    }

    private String formatAccount(String acc) {
        if (acc == null || acc.length() < 2) return acc;
        return acc.substring(0, acc.length() - 1) + "-" + acc.charAt(acc.length() - 1);
    }
}
