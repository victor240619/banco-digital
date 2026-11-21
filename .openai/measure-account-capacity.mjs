// Offline only: extracts the current Worker without building or publishing it.
// Synthetic identities/images only. No production data, credentials or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

globalThis.fetch = async () => { throw new Error('NETWORK_DISABLED_FOR_CAPACITY_TEST'); };
const source = await readFile(new URL('./build-sites-artifact.mjs', import.meta.url), 'utf8');
const seedStart = source.indexOf('async function loadLiveSeed()');
const seedEnd = source.indexOf('\nconst liveSeed = await loadLiveSeed();', seedStart);
assert(seedStart > 0 && seedEnd > seedStart);
const liveSeed = await vm.runInNewContext(
  source.slice(seedStart, seedEnd) + '\nloadLiveSeed()',
  { process: { env: { BRAVUS_SITES_TEST_BUILD: '1' } } },
);
assert.equal(liveSeed.verified, 'TEST_ONLY');
const start = source.indexOf('const entrypoint = `') + 'const entrypoint = '.length;
const end = source.indexOf('\nawait rm(artifactDir,', start);
assert(start > 20 && end > start);
const workerSource = vm.runInNewContext(source.slice(start, end).trim().replace(/;$/, ''), { files: {}, liveSeed });
const helper = `
export function capacityInit(env) {
  currentEnv = env; state = createInitialState();
  pendingBiometricWrites = []; pendingKycAuditWrites = [];
  pendingAccountProvisionAuditWrites = []; pendingMasterCreditEventWrites = [];
  pendingAccountControlEventWrites = []; return state;
}
export function capacityState() { return state; }
export function capacityRegister(body, ordinal) {
  pendingBiometricWrites = [];
  return handleApi(new Request('https://capacity.invalid/api/auth/register', {
    method:'POST', headers:{'content-type':'application/json','x-forwarded-for':'synthetic-'+ordinal},
    body: JSON.stringify(body)
  }));
}
`;
const worker = await import('data:text/javascript;base64,' + Buffer.from(workerSource + helper).toString('base64'));
const env = {
  BRAVUS_BIOMETRIC_KEY: Buffer.alloc(32, 37).toString('base64url'),
  BRAVUS_PASSWORD_PEPPER: 'synthetic-capacity-test-only',
  BRAVUS_ALLOW_TEST_BOOTSTRAP: 'true',
};
const initial = worker.capacityInit(env);
const baselineBytes = Buffer.byteLength(JSON.stringify(initial));
function cpfFor(ordinal) {
  let digits = String(100000000 + ordinal).split('').map(Number);
  for (const length of [9, 10]) {
    const sum = digits.reduce((total, value, i) => total + value * (length + 1 - i), 0);
    const check = 11 - sum % 11;
    digits.push(check >= 10 ? 0 : check);
  }
  return digits.join('');
}
function image(byte) {
  const bytes = Buffer.alloc(4200, byte);
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(bytes);
  Buffer.from('IHDR').copy(bytes,12);
  bytes.writeUInt32BE(640,16); bytes.writeUInt32BE(480,20);
  return 'data:image/png;base64,' + bytes.toString('base64');
}
const images = {documentFrontImage:image(11),documentBackImage:image(22),faceImage:image(33)};
const limitBytes = 2_000_000;
const checkpoints = [];
const registrationMs = [];
let belowLimit = null, aboveLimit = null, belowPayload = null;
for (let n = 1; n <= 1000; n++) {
  const body = {
    username:'capacity.'+String(n).padStart(6,'0'), email:'capacity.'+n+'@example.invalid',
    fullName:'Synthetic Capacity Customer '+String(n).padStart(6,'0'), cpf:cpfFor(n),phone:'11999990000',
    password:'SyntheticOnly123', numericPassword:'87654321', ...images,
    biometricChallenge:'FACE_CAMERA_CAPTURE_V1',idempotencyKey:'synthetic-capacity-'+String(n).padStart(6,'0'),
  };
  const began = performance.now();
  const response = await worker.capacityRegister(body,n);
  const result = await response.json();
  assert.equal(response.status,202,'Synthetic registration failed: '+result.code);
  assert.equal(result.accountCreated,true);
  const elapsed = performance.now()-began;
  registrationMs.push(elapsed);
  const state = worker.capacityState();
  const bytes = Buffer.byteLength(JSON.stringify(state));
  if ([1,10,50,100,200,300,400,500,750,1000].includes(n)) {
    checkpoints.push({newAccounts:n,totalAccounts:Object.keys(state.users).length,payloadBytes:bytes});
  }
  if (bytes < limitBytes) {
    belowLimit = {newAccounts:n,totalAccounts:Object.keys(state.users).length,payloadBytes:bytes};
    belowPayload = JSON.stringify(state);
  }
  else { aboveLimit = {newAccounts:n,totalAccounts:Object.keys(state.users).length,payloadBytes:bytes}; break; }
}
assert(belowLimit && aboveLimit,'Expected to bracket the documented row/string size ceiling');
assert(belowLimit.payloadBytes < limitBytes && aboveLimit.payloadBytes >= limitBytes);
const finalState = worker.capacityState();
const payload = JSON.stringify(finalState);
const parsed = JSON.parse(payload);
assert.equal(Object.keys(parsed.users).length,aboveLimit.totalAccounts);
assert.equal(new Set(Object.values(parsed.users).map(u=>u.accountNumber)).size,aboveLimit.totalAccounts);
const percentile = (values,p) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
// Reuse the existing transactional fake D1, never a live database.
const fakeSource = await readFile(new URL('./test-sites-d1.mjs',import.meta.url),'utf8');
const fakeStart = fakeSource.indexOf('class FakeStatement');
const fakeEnd = fakeSource.indexOf('\nconst workerPath =',fakeStart);
assert(fakeStart>0 && fakeEnd>fakeStart);
const FakeD1 = vm.runInNewContext(fakeSource.slice(fakeStart,fakeEnd)+'\nFakeD1', {structuredClone,createHash});
const database = new FakeD1();
const queueEnv = {...env,DB:database};
// Initialize fixtures with an unauthorized read; no fixture password is used.
assert.equal((await worker.default.fetch(new Request('https://capacity.invalid/api/user/me'),queueEnv)).status,401);
const queueState = JSON.parse(belowPayload);
// Synthetic state only; preserve the full registration metadata and ledger.
const syntheticAdmin = Object.values(queueState.users).find(u=>u.roles.includes('ROLE_ADMIN'));
assert(syntheticAdmin);
const token = 'capacity-synthetic-session';
queueState.sessions[token]={username:syntheticAdmin.username,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),clientChannel:'WEB'};
database.stateRow.payload=JSON.stringify(queueState);
database.stateRow.payload_hash=createHash('sha256').update(database.stateRow.payload).digest('hex');
const queueResults=[];
for (const concurrency of [1,5,10,25]) {
  const began=performance.now();
  const durations=await Promise.all(Array.from({length:concurrency},async()=>{
    const t=performance.now();
    const response=await worker.default.fetch(new Request('https://capacity.invalid/api/admin/dashboard',{
      headers:{authorization:'Bearer '+token},
    }),queueEnv);
    assert.equal(response.status,200,'Offline authenticated read failed');
    await response.text();
    return performance.now()-t;
  }));
  queueResults.push({concurrency,totalMs:Math.round(performance.now()-began),p95Ms:Math.round(percentile(durations,.95)),errors:0});
}
console.log(JSON.stringify({
  kind:'OFFLINE_SYNTHETIC_ONLY',baselineBytes,limitBytes,checkpoints,belowLimit,aboveLimit,
  averageAddedBytesPerRegistration:Math.round((belowLimit.payloadBytes-baselineBytes)/belowLimit.newAccounts),
  localRegistrationP95Ms:Math.round(percentile(registrationMs,.95)),queueFixturePayloadBytes:Buffer.byteLength(database.stateRow.payload),queueResults,
  limitations:['Not production storage size','No real D1 storage/latency/quotas are modeled','2 MB is a ceiling, not an operating target; SQL row metadata also consumes bytes','Synthetic minimal images; real document storage is separate and may dominate','No client history, real activity or deployment throughput guarantee','Queue fixture uses the below-ceiling synthetic state; timings are local only'],
},null,2));
