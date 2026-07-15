import assert from 'node:assert/strict';
import { blobToBase64 } from '../bravus-bank-frontend/src/lib/nativeReceiptDocuments.js';

const source = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';
const pdf = new Blob([source], { type: 'application/pdf' });
const encoded = await blobToBase64(pdf);
const decoded = Buffer.from(encoded, 'base64');

assert.equal(decoded.toString('ascii'), source, 'native conversion must preserve every PDF byte');
assert.equal(decoded.subarray(0, 5).toString('ascii'), '%PDF-', 'saved document must retain its PDF header');
assert.equal(decoded.subarray(-5).toString('ascii'), '%%EOF', 'saved document must retain its PDF trailer');

console.log('native receipt PDF conversion: ok');
