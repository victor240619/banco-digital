package com.bravus.bank.auth.recovery;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice(assignableTypes = {PasswordResetController.class, AdminPasswordResetController.class})
public class PasswordResetExceptionHandler {
    @ExceptionHandler(PasswordResetException.class)
    public ResponseEntity<?> handle(PasswordResetException error) {
        HttpStatus status = "RATE_LIMITED".equals(error.getCode())
                ? HttpStatus.TOO_MANY_REQUESTS
                : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of(
                "code", error.getCode(),
                "message", error.getMessage()
        ));
    }
}
