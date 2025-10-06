package com.bravus.bank.callback;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CallbackController {

    @GetMapping("/success")
    public ResponseEntity<String> success(@RequestParam(name = "session_id", required = false) String sessionId) {
        return ResponseEntity.ok("Pagamento/Assinatura concluído com sucesso. session_id=" + (sessionId == null ? "" : sessionId));
    }

    @GetMapping("/cancel")
    public ResponseEntity<String> cancel() {
        return ResponseEntity.ok("Pagamento/Assinatura cancelado pelo usuário.");
    }
}
