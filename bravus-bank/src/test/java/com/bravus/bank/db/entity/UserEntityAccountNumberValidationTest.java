package com.bravus.bank.db.entity;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserEntityAccountNumberValidationTest {
    private static Validator validator;

    @BeforeAll
    static void createValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void acceptsExactlySixNonReservedDigits() {
        UserEntity user = new UserEntity();
        user.setAccountNumber("123456");

        assertTrue(validator.validateProperty(user, "accountNumber").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"12345", "1234567", "12A456", "000000"})
    void rejectsInvalidOrReservedAccountNumbers(String accountNumber) {
        UserEntity user = new UserEntity();
        user.setAccountNumber(accountNumber);

        assertFalse(validator.validateProperty(user, "accountNumber").isEmpty());
    }
}
