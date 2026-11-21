import { probeOriginalLogin } from '/probe.mjs';
const form = document.getElementById('probe');
const password = document.getElementById('password');
const show = document.getElementById('show');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
const qaOnly = new URLSearchParams(location.search).get('qa') === '1';
let running = false;
if (qaOnly) {
  const verify = document.createElement('button');
  verify.type = 'button';
  verify.textContent = 'Validar dados fictícios sem enviar';
  verify.addEventListener('click', () => {
    status.textContent = password.value === 'fixture-password-only'
      && password.type === 'password' && show.getAttribute('aria-pressed') === 'false'
      ? 'TESTE PASSOU: valor fictício preservado, senha mascarada e botão não submeteu o formulário.'
      : 'TESTE FALHOU.';
  });
  form.append(verify);
}
show.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  show.setAttribute('aria-pressed', String(visible));
  show.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
  document.getElementById('eye').style.display = visible ? 'none' : '';
  document.getElementById('eyeoff').style.display = visible ? '' : 'none';
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (qaOnly) { status.textContent = 'TESTE: envio bloqueado; nenhuma chamada à API.'; return; }
  if (running) return;
  running = true;
  submit.disabled = true;
  status.textContent = 'Verificando no ambiente anterior…';
  const fields = new FormData(form);
  const check = probeOriginalLogin(String(fields.get('username') || ''), String(fields.get('password') || ''));
  form.reset();
  password.type = 'password';
  show.setAttribute('aria-pressed', 'false');
  show.setAttribute('aria-label', 'Mostrar senha');
  document.getElementById('eye').style.display = '';
  document.getElementById('eyeoff').style.display = 'none';
  const result = await check;
  if (result.result === 'matched') {
    status.textContent = result.sessionClosed
      ? `ACESSO ANTERIOR CONFIRMADO${result.administrator ? ' — ADMINISTRADOR' : ''}. A sessão de verificação foi encerrada.`
      : 'ACESSO ANTERIOR CONFIRMADO. Não foi possível confirmar o encerramento da sessão de verificação.';
  } else if (result.result === 'matched_restricted') {
    status.textContent = 'CREDENCIAL RECONHECIDA NO AMBIENTE ANTERIOR. A conta exige uma etapa adicional ou possui uma restrição. Nenhuma senha foi alterada.';
  } else if (result.result === 'rejected') {
    status.textContent = 'O AMBIENTE ANTERIOR TAMBÉM REJEITOU ESSA COMBINAÇÃO. Confira o identificador e o tipo de senha usados. Nenhuma senha foi alterada.';
  } else {
    status.textContent = 'Não foi possível verificar o ambiente anterior. Nenhuma conclusão sobre a senha foi obtida.';
  }
  running = false;
  submit.disabled = false;
});
