package com.bravus.bank.user;

import com.bravus.bank.db.entity.UserEntity;
import org.springframework.stereotype.Component;

@Component
public class OutboundOperationPolicy {
    public static final String RESTRICTION_CODE = "ACCOUNT_UNDER_REVIEW";
    public static final String RESTRICTION_MESSAGE =
            "N\u00e3o foi poss\u00edvel concluir esta opera\u00e7\u00e3o. Sua conta est\u00e1 passando por uma an\u00e1lise interna "
                    + "de seguran\u00e7a e valida\u00e7\u00e3o cadastral. Esse processo pode levar at\u00e9 15 dias corridos. "
                    + "Enquanto isso, a conta permanece habilitada para receber valores normalmente.";

    public void assertAllowed(UserEntity user) {
        if (!Boolean.TRUE.equals(user.getOutboundOperationsEnabled())) {
            throw new OutboundOperationRestrictedException(RESTRICTION_CODE, RESTRICTION_MESSAGE);
        }
    }
}
