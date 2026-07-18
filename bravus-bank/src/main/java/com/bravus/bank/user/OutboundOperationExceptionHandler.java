package com.bravus.bank.user;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class OutboundOperationExceptionHandler {
    @ExceptionHandler(OutboundOperationRestrictedException.class)
    public ResponseEntity<Map<String, String>> restricted(OutboundOperationRestrictedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "code", exception.getCode(),
                "message", exception.getMessage()
        ));
    }
}
