import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expectedOrigin = 'https://bravusbank.com';
const forbiddenHost = 'bravus-bank-240619.victor2406.chatgpt.site';
const files = [
  'bravus-bank-frontend/capacitor.config.json',
  'bravus-bank-frontend/src/lib/appChannel.js',
  'bravus-bank-frontend/android/app/build.gradle',
  'render.yaml',
  '.openai/build-sites-artifact.mjs',
];

const contents = await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')]));
for (const [file, content] of contents) {
  assert.equal(content.includes(forbiddenHost), false, `${file} must not expose the technical Sites hostname`);
}

const capacitorConfig = JSON.parse(contents.find(([file]) => file.endsWith('capacitor.config.json'))[1]);
assert.equal(capacitorConfig.server.url, expectedOrigin);
assert.match(contents.find(([file]) => file.endsWith('appChannel.js'))[1], /https:\/\/bravusbank\.com\/api/);
assert.match(contents.find(([file]) => file.endsWith('build.gradle'))[1], /versionCode\s+4/);
assert.match(contents.find(([file]) => file.endsWith('build.gradle'))[1], /versionName\s+"1\.3\.0"/);
assert.match(contents.find(([file]) => file === 'render.yaml')[1], /value:\s+"https:\/\/bravusbank\.com"/);
assert.match(contents.find(([file]) => file.endsWith('build-sites-artifact.mjs'))[1], /banco-digital\/master\/bravus-bank-frontend/);
assert.match(contents.find(([file]) => file.endsWith('build-sites-artifact.mjs'))[1], /hostname\.endsWith\("\.chatgpt\.site"\)/);

console.log('Native production origin tests passed.');
