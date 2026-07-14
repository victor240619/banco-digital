package com.bravus.bank.auth.recovery;

import java.util.EnumSet;
import java.util.Map;

public enum PasswordResetStatus {
    FACE_PENDING,
    REVIEW_PENDING,
    VERIFIED,
    CONSUMED,
    REJECTED,
    EXPIRED,
    LOCKED;

    private static final Map<PasswordResetStatus, EnumSet<PasswordResetStatus>> ALLOWED = Map.of(
            FACE_PENDING, EnumSet.of(REVIEW_PENDING, REJECTED, EXPIRED, LOCKED),
            REVIEW_PENDING, EnumSet.of(VERIFIED, REJECTED, EXPIRED, LOCKED),
            VERIFIED, EnumSet.of(CONSUMED, EXPIRED),
            CONSUMED, EnumSet.noneOf(PasswordResetStatus.class),
            REJECTED, EnumSet.noneOf(PasswordResetStatus.class),
            EXPIRED, EnumSet.noneOf(PasswordResetStatus.class),
            LOCKED, EnumSet.noneOf(PasswordResetStatus.class)
    );

    public boolean canTransitionTo(PasswordResetStatus next) {
        return this == next || ALLOWED.get(this).contains(next);
    }
}
