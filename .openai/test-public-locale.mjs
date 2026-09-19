import assert from 'node:assert/strict';
import {
  LOCALE_STORAGE_KEY,
  detectLocale,
  persistLocalePreference,
  readLocalePreference,
  translate,
} from '../bravus-bank-frontend/src/lib/publicLocale.js';

assert.equal(detectLocale(['pt-PT', 'en-US']), 'pt-BR');
assert.equal(detectLocale(['es-MX', 'en-US']), 'es');
assert.equal(detectLocale(['en-GB']), 'en');
assert.equal(detectLocale(['fr-FR']), 'en');
assert.equal(detectLocale([]), 'en');

const values = new Map();
const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
assert.equal(readLocalePreference(storage, ['es-CO']), 'es');
assert.equal(persistLocalePreference(storage, 'pt-BR'), true);
assert.equal(values.get(LOCALE_STORAGE_KEY), 'pt-BR');
assert.equal(readLocalePreference(storage, ['en-US']), 'pt-BR');
assert.equal(persistLocalePreference(storage, 'de'), false);

assert.equal(translate('en', 'Entrar'), 'Sign in');
assert.equal(translate('es', 'Entrar'), 'Ingresar');
assert.equal(translate('pt-BR', 'Entrar'), 'Entrar');
assert.equal(translate('en', 'Vantyx'), 'Vantyx');
assert.equal(translate('es', 'E-mail institucional'), 'Correo institucional');

const blockedStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
assert.equal(readLocalePreference(blockedStorage, ['pt-BR']), 'pt-BR');
assert.equal(persistLocalePreference(blockedStorage, 'en'), false);
console.log('public locale: browser preference, manual override, fallback and storage isolation passed');
