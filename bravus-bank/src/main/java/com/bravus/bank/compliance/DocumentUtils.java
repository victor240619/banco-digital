package com.bravus.bank.compliance;

final class DocumentUtils {
    private DocumentUtils() {}

    static String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    static String inferType(String type, String document) {
        if (type != null && !type.isBlank()) return type.trim().toUpperCase();
        String digits = digits(document);
        if (digits.length() == 11) return "CPF";
        if (digits.length() == 14) return "CNPJ";
        return "UNKNOWN";
    }

    static boolean validCpf(String cpf) {
        String d = digits(cpf);
        if (d.length() != 11 || d.chars().distinct().count() == 1) return false;
        int sum = 0;
        for (int i = 0; i < 9; i++) sum += Character.digit(d.charAt(i), 10) * (10 - i);
        int first = 11 - (sum % 11);
        if (first >= 10) first = 0;
        if (first != Character.digit(d.charAt(9), 10)) return false;
        sum = 0;
        for (int i = 0; i < 10; i++) sum += Character.digit(d.charAt(i), 10) * (11 - i);
        int second = 11 - (sum % 11);
        if (second >= 10) second = 0;
        return second == Character.digit(d.charAt(10), 10);
    }

    static boolean validCnpj(String cnpj) {
        String d = digits(cnpj);
        if (d.length() != 14 || d.chars().distinct().count() == 1) return false;
        int[] w1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int[] w2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int first = cnpjDigit(d, w1, 12);
        int second = cnpjDigit(d, w2, 13);
        return first == Character.digit(d.charAt(12), 10)
                && second == Character.digit(d.charAt(13), 10);
    }

    private static int cnpjDigit(String digits, int[] weights, int length) {
        int sum = 0;
        for (int i = 0; i < length; i++) {
            sum += Character.digit(digits.charAt(i), 10) * weights[i];
        }
        int mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
    }
}
