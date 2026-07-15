const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';

const safeStorage = (getter) => {
  try {
    return typeof getter === 'function' ? getter() : null;
  } catch {
    return null;
  }
};

const removeAuthKeys = (storage) => {
  try {
    storage?.removeItem(AUTH_TOKEN_KEY);
    storage?.removeItem(AUTH_USER_KEY);
  } catch {
    // Storage can be unavailable in hardened WebViews.
  }
};

const parseUser = (value) => {
  try {
    return JSON.parse(value || 'null');
  } catch {
    return null;
  }
};

const withoutToken = (session) => {
  if (!session || typeof session !== 'object') return null;
  const { token: _token, ...user } = session;
  return user;
};

export function createAuthSessionStore({
  isNative = () => false,
  getPersistentStorage = () => null,
  getTransientStorage = () => null,
} = {}) {
  let memoryToken = null;
  let memoryUser = null;
  let version = 0;

  const persistentStorage = () => safeStorage(getPersistentStorage);
  const transientStorage = () => safeStorage(getTransientStorage);
  const native = () => Boolean(isNative());
  const clearStoredAuth = () => {
    removeAuthKeys(persistentStorage());
    removeAuthKeys(transientStorage());
  };

  return {
    initialize() {
      memoryToken = null;
      memoryUser = null;
      version += 1;
      if (native()) clearStoredAuth();
    },
    clear() {
      memoryToken = null;
      memoryUser = null;
      version += 1;
      clearStoredAuth();
    },
    set(session, { expectedVersion } = {}) {
      if (!session?.token || (expectedVersion != null && expectedVersion !== version)) return false;
      const user = withoutToken(session);
      if (native()) {
        clearStoredAuth();
        memoryToken = session.token;
        memoryUser = user;
        return true;
      }
      const storage = persistentStorage();
      if (!storage) return false;
      try {
        storage.setItem(AUTH_TOKEN_KEY, session.token);
        storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        return true;
      } catch {
        removeAuthKeys(storage);
        return false;
      }
    },
    getToken() {
      if (native()) return memoryToken;
      try {
        return persistentStorage()?.getItem(AUTH_TOKEN_KEY) || null;
      } catch {
        return null;
      }
    },
    getUser() {
      if (native()) return memoryUser;
      try {
        return parseUser(persistentStorage()?.getItem(AUTH_USER_KEY));
      } catch {
        return null;
      }
    },
    updateUser(patch) {
      const current = this.getUser();
      if (!current) return null;
      const updated = { ...current, ...patch };
      if (native()) {
        memoryUser = updated;
        return updated;
      }
      try {
        persistentStorage()?.setItem(AUTH_USER_KEY, JSON.stringify(updated));
        return updated;
      } catch {
        return null;
      }
    },
    getVersion() {
      return version;
    },
  };
}
