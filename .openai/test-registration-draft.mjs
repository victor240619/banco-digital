import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const modulePath = resolve("bravus-bank-frontend/src/lib/registrationDraft.js");
const draft = await import(pathToFileURL(modulePath));
const key = "bravus.registration.draft.v1";

draft.saveRegistrationDraft({
  username: "cliente.teste",
  email: "cliente@bravus.test",
  fullName: "Cliente Teste",
  cpf: "529.982.247-25",
  phone: "(11) 99999-9999",
  password: "NaoDevePersistir123",
  confirmPassword: "NaoDevePersistir123",
});
const persisted = JSON.parse(values.get(key));
assert.equal(persisted.username, "cliente.teste");
assert.equal("password" in persisted, false, "password must never be persisted in the draft");
assert.equal("confirmPassword" in persisted, false, "password confirmation must never be persisted in the draft");
assert.equal(draft.hasRegistrationDraft(), true);

values.set(key, JSON.stringify({ ...persisted, savedAt: Date.now() - 3 * 60 * 60 * 1000 }));
assert.deepEqual(draft.loadRegistrationDraft(), {
  username: "", email: "", fullName: "", cpf: "", phone: "",
});
assert.equal(values.has(key), false, "expired draft must be removed");

draft.saveRegistrationDraft({ username: "novo" });
draft.clearRegistrationDraft();
assert.equal(values.has(key), false);

console.log(JSON.stringify({ result: "ok", sensitiveFieldsPersisted: false, ttlVerified: true }));
