const REGISTRATION_DRAFT_KEY = 'bravus.registration.draft.v1';
const REGISTRATION_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

const EMPTY_DRAFT = {
  username: '',
  email: '',
  fullName: '',
  cpf: '',
  phone: '',
};

export function loadRegistrationDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(REGISTRATION_DRAFT_KEY) || 'null');
    if (!saved || typeof saved !== 'object' || !saved.savedAt
      || Date.now() - Number(saved.savedAt) > REGISTRATION_DRAFT_TTL_MS) {
      localStorage.removeItem(REGISTRATION_DRAFT_KEY);
      return { ...EMPTY_DRAFT };
    }
    return Object.fromEntries(
      Object.keys(EMPTY_DRAFT).map((field) => [field, typeof saved[field] === 'string' ? saved[field] : ''])
    );
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveRegistrationDraft(formData) {
  try {
    const draft = Object.fromEntries(
      Object.keys(EMPTY_DRAFT).map((field) => [field, String(formData[field] || '')])
    );
    if (Object.values(draft).some(Boolean)) {
      localStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } else {
      localStorage.removeItem(REGISTRATION_DRAFT_KEY);
    }
  } catch {
    // Storage can be unavailable in hardened WebViews; registration still continues in memory.
  }
}

export function clearRegistrationDraft() {
  try {
    localStorage.removeItem(REGISTRATION_DRAFT_KEY);
  } catch {
    // Account creation must not be reported as failed because local cleanup was blocked.
  }
}

export function hasRegistrationDraft() {
  const draft = loadRegistrationDraft();
  return Boolean(draft.username || draft.email || draft.fullName || draft.cpf || draft.phone);
}
