// Reference quotes only. No authenticated bank API, balance writes or stored funds.
export const EXCHANGE_CURRENCIES = Object.freeze([
  ['USD', 'Dólar americano'], ['BRL', 'Real brasileiro'], ['EUR', 'Euro'],
  ['GBP', 'Libra esterlina'], ['CHF', 'Franco suíço'], ['CAD', 'Dólar canadense'], ['AUD', 'Dólar australiano'],
  ['JPY', 'Iene japonês'], ['CNY', 'Yuan chinês'], ['MXN', 'Peso mexicano'], ['ZAR', 'Rand sul-africano'],
  ['NZD', 'Dólar neozelandês'], ['SGD', 'Dólar de Singapura'], ['HKD', 'Dólar de Hong Kong'],
  ['KRW', 'Won sul-coreano'], ['INR', 'Rúpia indiana'], ['IDR', 'Rupia indonésia'],
  ['SEK', 'Coroa sueca'], ['NOK', 'Coroa norueguesa'], ['DKK', 'Coroa dinamarquesa'],
  ['PLN', 'Zloty polonês'], ['CZK', 'Coroa tcheca'], ['HUF', 'Forint húngaro'], ['RON', 'Leu romeno'],
  ['TRY', 'Lira turca'], ['ILS', 'Novo shekel israelense'], ['ISK', 'Coroa islandesa'],
  ['MYR', 'Ringgit malaio'], ['PHP', 'Peso filipino'], ['THB', 'Baht tailandês'],
]);
export const DEFAULT_EXCHANGE_PAIR = Object.freeze({ base: 'USD', quote: 'BRL' });
export const QUOTE_SOURCE = Object.freeze({ name: 'Banco Central Europeu, via Frankfurter', url: 'https://frankfurter.dev/' });
const codes = new Set(EXCHANGE_CURRENCIES.map(([code]) => code));
const DAY = 86400000;

export function parseExchangeAmount(input) {
  let raw = String(input ?? '').trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) raw = raw.replace(/\./g, '');
  raw = raw.replace(',', '.');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(raw)) throw new Error('Informe um valor positivo, com até duas casas decimais.');
  const [whole, decimals = ''] = raw.split('.');
  const minor = BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
  if (minor <= 0n) throw new Error('O valor precisa ser maior que zero.');
  return minor;
}

export function quoteIsFresh(quote, now = Date.now()) {
  const time = Date.parse(`${quote?.date}T00:00:00Z`);
  return Number.isFinite(time) && now - time <= 7 * DAY && time <= now + DAY;
}

export function validateQuote(data, base, quote, now = Date.now()) {
  const dateTime = Date.parse(`${data?.date}T00:00:00Z`);
  if (!data || data.base !== base || data.quote !== quote || typeof data.rate !== 'number'
    || !Number.isFinite(data.rate) || data.rate <= 0 || data.rate > 1000000
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')
    || !Number.isFinite(dateTime) || new Date(dateTime).toISOString().slice(0, 10) !== data.date) {
    throw new Error('O serviço retornou uma cotação inválida. Tente atualizar.');
  }
  if (!quoteIsFresh(data, now)) throw new Error('A cotação recebida está desatualizada. Tente novamente mais tarde.');
  const rate = data.rate.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  if (Number(rate) <= 0) throw new Error('Precisão da cotação indisponível.');
  return Object.freeze({ base, quote, rate, date: data.date, fetchedAt: new Date(now).toISOString(), source: QUOTE_SOURCE.name });
}

export async function fetchExchangeQuote(base, quote, { signal, fetchImpl = fetch, now = Date.now(), timeoutMs = 12000 } = {}) {
  if (!codes.has(base) || !codes.has(quote)) throw new Error('Moeda não suportada.');
  if (base === quote) return Object.freeze({ base, quote, rate: '1', date: new Date(now).toISOString().slice(0, 10), fetchedAt: new Date(now).toISOString(), source: 'Mesma moeda - sem câmbio' });
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    // Never transmit an account identifier, token or the customer's input amount.
    const response = await fetchImpl(`https://api.frankfurter.dev/v2/rate/${base}/${quote}?providers=ECB`, {
      method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error('Não foi possível consultar a cotação. Tente novamente.');
    return validateQuote(await response.json(), base, quote, now);
  } catch (error) {
    if (timedOut) throw new Error('A consulta demorou mais que o esperado. Tente atualizar a cotação.');
    if (error.name === 'AbortError') throw error;
    if (error instanceof TypeError) throw new Error('Cotação indisponível. Verifique sua conexão e tente novamente.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function simulateExchange(amount, quote, now = Date.now()) {
  if (!quote || !codes.has(quote.base) || !codes.has(quote.quote) || !quoteIsFresh(quote, now)) throw new Error('Atualize a cotação antes de simular.');
  if (!/^\d+(?:\.\d{1,12})?$/.test(quote.rate)) throw new Error('Cotação inválida.');
  const [whole, decimals = ''] = quote.rate.split('.');
  const scale = 10n ** BigInt(decimals.length);
  const rate = BigInt(whole + decimals);
  if (rate <= 0n) throw new Error('Cotação inválida.');
  const sourceMinor = parseExchangeAmount(amount);
  // Integer arithmetic, round-half-up only once at the destination minor unit.
  const decimalsTarget = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: quote.quote }).resolvedOptions().maximumFractionDigits;
  const numerator = sourceMinor * rate * (10n ** BigInt(decimalsTarget));
  const denominator = scale * 100n;
  const targetMinor = (numerator * 2n + denominator) / (denominator * 2n);
  return Object.freeze({ sourceMinor: sourceMinor.toString(), targetMinor: targetMinor.toString(), base: quote.base, quote: quote.quote, rate: quote.rate, date: quote.date, simulated: true });
}
