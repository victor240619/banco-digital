import React, { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Info, Globe2 } from 'lucide-react';
import { DEFAULT_EXCHANGE_PAIR, EXCHANGE_CURRENCIES, QUOTE_SOURCE, fetchExchangeQuote, quoteIsFresh, simulateExchange } from '../lib/exchangeQuotes';
import { formatReceiptAmount } from '../lib/receiptModel';
import './exchange.css';

export default function CurrencyExchangePanel() {
  const base = DEFAULT_EXCHANGE_PAIR.base;
  const [target, setTarget] = useState(DEFAULT_EXCHANGE_PAIR.quote);
  const [amount, setAmount] = useState('');
  const [snapshot, setSnapshot] = useState({ loading: true, quote: null, error: '' });
  const [result, setResult] = useState(null);
  const [inputError, setInputError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot({ loading: true, quote: null, error: '' });
    setResult(null);
    fetchExchangeQuote(base, target, { signal: controller.signal })
      .then((quote) => { if (!controller.signal.aborted) setSnapshot({ loading: false, quote, error: '' }); })
      .catch((error) => { if (!controller.signal.aborted) setSnapshot({ loading: false, quote: null, error: error.message }); });
    return () => controller.abort();
  }, [base, target, revision]);
  const currentQuote = snapshot.quote?.base === base && snapshot.quote?.quote === target ? snapshot.quote : null;
  const change = (setter) => (event) => { setter(event.target.value); setResult(null); setInputError(''); };
  const submit = (event) => {
    event.preventDefault();
    setInputError('');
    try { setResult(simulateExchange(amount, currentQuote)); }
    catch (error) { setResult(null); setInputError(error.message); }
  };
  return <section className="vantyx-exchange" aria-labelledby="exchange-title">
    <div className="vantyx-exchange-heading"><Globe2 size={24} /><div><h2 id="exchange-title">Câmbio de moedas</h2><p>Cotações reais de referência. Simulação sem movimentar seu saldo.</p></div></div>
    <form onSubmit={submit}>
      <div className="vantyx-exchange-pair">
        <label>Moeda de origem<input aria-label="Moeda de origem" value="USD - Dólar americano" readOnly /></label>
        <span className="vantyx-exchange-swap" aria-hidden="true"><ArrowRight size={20} /></span>
        <label>Moeda de destino<select value={target} onChange={change(setTarget)}>{EXCHANGE_CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}</select></label>
      </div>
      <label className="vantyx-exchange-amount">Valor em {base}<input type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amount} onChange={change(setAmount)} maxLength={20} aria-describedby="exchange-disclaimer" /></label>
      <div className="vantyx-exchange-quote" aria-live="polite">
        <div>{snapshot.loading ? 'Consultando cotação...' : currentQuote ? <><strong>1 {base} = {Number(currentQuote.rate).toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {target}</strong><span>Referência de {currentQuote.date.split('-').reverse().join('/')} · {currentQuote.source}</span></> : 'Cotação indisponível'}</div>
        <button type="button" className="vantyx-exchange-refresh" disabled={snapshot.loading} onClick={() => { setResult(null); setRevision((value) => value + 1); }}><RefreshCw size={16} />Atualizar</button>
      </div>
      {(snapshot.error || inputError) && <p className="vantyx-exchange-error" role="alert">{snapshot.error || inputError}</p>}
      <button className="vantyx-exchange-submit" type="submit" disabled={snapshot.loading || !currentQuote || !quoteIsFresh(currentQuote)}>Simular conversão</button>
    </form>
    {result && <div className="vantyx-exchange-result" role="status"><span>VALOR ESTIMADO EM {result.quote}</span><strong>{formatReceiptAmount(result.targetMinor, result.quote)}</strong><p>{formatReceiptAmount(result.sourceMinor, result.base)} pela cotação de {result.date.split('-').reverse().join('/')}. Nenhum valor foi debitado ou creditado.</p></div>}
    <div id="exchange-disclaimer" className="vantyx-exchange-note"><Info size={19} /><div><strong>Sobre esta cotação</strong><p>Referência diária, não uma oferta executável nem cotação em tempo real. O resultado não inclui tarifas, spread ou impostos. Em dias sem publicação, aparece a última referência disponível.</p><a href={QUOTE_SOURCE.url} target="_blank" rel="noopener noreferrer">Consultar a fonte das cotações</a></div></div>
    <div className="vantyx-exchange-unavailable"><strong>Conversão de saldo ainda indisponível</strong><p>A conta atual registra saldo em BRL. Converter saldo USD para a moeda escolhida exige carteiras nas duas moedas, saldo de origem verificado e um serviço de liquidação habilitado. Esta simulação não cria saldo em dólares nem altera seus reais.</p></div>
  </section>;
}
