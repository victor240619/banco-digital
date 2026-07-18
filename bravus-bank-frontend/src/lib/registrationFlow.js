export const REGISTRATION_STEP = Object.freeze({
  DOCUMENTS: 'DOCUMENTS',
  BIOMETRICS: 'BIOMETRICS',
  REVIEW: 'REVIEW',
});

export function hasRegistrationDocuments(documents) {
  return Boolean(documents?.documentFrontImage && documents?.documentBackImage);
}

export function registrationStep(documents) {
  if (!hasRegistrationDocuments(documents)) return REGISTRATION_STEP.DOCUMENTS;
  if (!documents?.faceImage) return REGISTRATION_STEP.BIOMETRICS;
  return REGISTRATION_STEP.REVIEW;
}
