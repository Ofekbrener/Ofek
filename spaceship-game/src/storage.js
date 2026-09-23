// localStorage can throw (private mode, blocked storage) — never let that break the game.
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('voidrunner:' + key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  remove(key) {
    try { localStorage.removeItem('voidrunner:' + key); } catch { /* ignore */ }
  },
  set(key, value) {
    try { localStorage.setItem('voidrunner:' + key, String(value)); } catch { /* ignore */ }
  },
};
