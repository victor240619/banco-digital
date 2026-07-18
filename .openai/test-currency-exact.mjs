import assert from "node:assert/strict";
import { formatCurrencyExact, reaisToCentavosExact } from "../bravus-bank-frontend/src/utils/helpers.js";

assert.equal(
  formatCurrencyExact("100000000000000000"),
  "KYD 1.000.000.000.000.000,00",
  "one quadrillion KYD must render without floating-point precision loss",
);
assert.equal(formatCurrencyExact("1000"), "KYD 10,00");
assert.equal(formatCurrencyExact("-105"), "-KYD 1,05");
assert.equal(reaisToCentavosExact("123.45"), "12345");
assert.equal(reaisToCentavosExact("123,4"), "12340");
assert.equal(reaisToCentavosExact("1.234"), null);

console.log(JSON.stringify({
  result: "ok",
  masterCreditReserve: formatCurrencyExact("100000000000000000"),
  exactIntegerFormattingVerified: true,
  exactInputParsingVerified: true,
}));
