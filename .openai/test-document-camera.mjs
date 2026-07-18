import assert from 'node:assert/strict';
import {
  DOCUMENT_CAMERA_CONSTRAINTS,
  documentCameraErrorMessage,
  documentCaptureDimensions,
} from '../bravus-bank-frontend/src/lib/documentCamera.js';

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { mediaDevices: { getUserMedia() {} } },
});

assert.deepEqual(DOCUMENT_CAMERA_CONSTRAINTS.video.facingMode, { ideal: 'environment' });
assert.equal(DOCUMENT_CAMERA_CONSTRAINTS.audio, false);
assert.deepEqual(documentCaptureDimensions(4000, 3000), { width: 1600, height: 1200 });
assert.deepEqual(documentCaptureDimensions(800, 600), { width: 800, height: 600 });
assert.match(documentCameraErrorMessage({ name: 'NotAllowedError' }), /Permita o acesso/);
assert.match(documentCameraErrorMessage({ name: 'NotFoundError' }), /Nenhuma camera/);
assert.match(documentCameraErrorMessage({ name: 'NotSupportedError' }), /nao oferece camera/);

console.log('Document camera tests passed.');
