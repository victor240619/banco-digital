package com.bravus.bank.auth.recovery;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PasswordResetStatusTest {
    @Test
    void allowsExpectedLifecycleAndRejectsSkippingReview() {
        assertTrue(PasswordResetStatus.FACE_PENDING.canTransitionTo(PasswordResetStatus.REVIEW_PENDING));
        assertTrue(PasswordResetStatus.REVIEW_PENDING.canTransitionTo(PasswordResetStatus.VERIFIED));
        assertTrue(PasswordResetStatus.VERIFIED.canTransitionTo(PasswordResetStatus.CONSUMED));
        assertFalse(PasswordResetStatus.FACE_PENDING.canTransitionTo(PasswordResetStatus.VERIFIED));
        assertFalse(PasswordResetStatus.CONSUMED.canTransitionTo(PasswordResetStatus.VERIFIED));
    }

    @Test
    void entityFailsClosedOnInvalidTransition() {
        PasswordResetRequestEntity request = new PasswordResetRequestEntity();
        request.setStatus(PasswordResetStatus.FACE_PENDING);

        assertThrows(IllegalStateException.class,
                () -> request.transitionTo(PasswordResetStatus.CONSUMED));
        assertEquals(PasswordResetStatus.FACE_PENDING, request.getStatus());
    }
}
