package com.bravus.bank.user;

import com.bravus.bank.db.entity.UserEntity;
import org.springframework.stereotype.Component;

@Component
public class OutboundOperationPolicy {
    public static final String RESTRICTION_CODE = "ACCOUNT_UNDER_REVIEW";
    public static final String RESTRICTION_MESSAGE =
            "Transfer\u00eancias temporariamente indispon\u00edveis. Estamos concluindo a an\u00e1lise de seguran\u00e7a "
                    + "e a valida\u00e7\u00e3o dos dados da sua conta, processo que pode levar at\u00e9 15 dias corridos. "
                    + "Durante esse per\u00edodo, voc\u00ea pode receber valores normalmente.";

    public void assertAllowed(UserEntity user) {
        if (!Boolean.TRUE.equals(user.getOutboundOperationsEnabled())) {
            throw new OutboundOperationRestrictedException(RESTRICTION_CODE, RESTRICTION_MESSAGE);
        }
    }
}
