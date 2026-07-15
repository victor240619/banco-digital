import assert from "node:assert/strict";
import { formatCurrencyExact } from "../bravus-bank-frontend/src/utils/helpers.js";

assert.equal(
  formatCurrencyExact("100000000000000000"),
  "R$ 1.000.000.000.000.000,00",
  "one quadrillion reais must render without floating-point precision loss",
);
assert.equal(formatCurrencyExact("1000"), "R$ 10,00");
assert.equal(formatCurrencyExact("-105"), "-R$ 1,05");

console.log(JSON.stringify({
  result: "ok",
  institutionalReserve: formatCurrencyExact("100000000000000000"),
  exactIntegerFormattingVerified: true,
}));
