import assert from 'node:assert/strict';
import {
  REGISTRATION_STEP,
  hasRegistrationDocuments,
  registrationStep,
} from '../bravus-bank-frontend/src/lib/registrationFlow.js';

const front = 'data:image/jpeg;base64,front';
const back = 'data:image/jpeg;base64,back';
const face = 'data:image/jpeg;base64,face';

assert.equal(registrationStep({}), REGISTRATION_STEP.DOCUMENTS);
assert.equal(registrationStep({ documentFrontImage: front }), REGISTRATION_STEP.DOCUMENTS);
assert.equal(hasRegistrationDocuments({ documentFrontImage: front, documentBackImage: back }), true);
assert.equal(
  registrationStep({ documentFrontImage: front, documentBackImage: back }),
  REGISTRATION_STEP.BIOMETRICS,
);
assert.equal(
  registrationStep({ documentFrontImage: front, documentBackImage: back, faceImage: face }),
  REGISTRATION_STEP.REVIEW,
);

console.log('Registration flow tests passed.');
