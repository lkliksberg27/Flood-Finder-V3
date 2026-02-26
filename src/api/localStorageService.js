const EVENT_PREFIX = 'local-entity-change:';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function writeStore(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function notify(key, event) {
  window.dispatchEvent(new CustomEvent(EVENT_PREFIX + key, { detail: event }));
}

export function createLocalEntity(storageKey) {
  return {
    async list(sortParam) {
      let items = readStore(storageKey);

      if (sortParam) {
        const desc = sortParam.startsWith('-');
        const field = desc ? sortParam.slice(1) : sortParam;
        items.sort((a, b) => {
          const av = a[field] ?? '';
          const bv = b[field] ?? '';
          if (av < bv) return desc ? 1 : -1;
          if (av > bv) return desc ? -1 : 1;
          return 0;
        });
      }

      return items;
    },

    async create(data) {
      const id = generateId();
      const item = { id, ...data, created_date: new Date().toISOString() };
      const items = readStore(storageKey);
      items.push(item);
      writeStore(storageKey, items);
      notify(storageKey, { type: 'create', id, data: item });
      return item;
    },

    async update(id, data) {
      const items = readStore(storageKey);
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return { id, ...data };
      items[idx] = { ...items[idx], ...data };
      writeStore(storageKey, items);
      notify(storageKey, { type: 'update', id, data: items[idx] });
      return items[idx];
    },

    async delete(id) {
      const items = readStore(storageKey);
      const item = items.find(i => i.id === id);
      const filtered = items.filter(i => i.id !== id);
      writeStore(storageKey, filtered);
      notify(storageKey, { type: 'delete', id, data: item || { id } });
      return { id };
    },

    subscribe(callback) {
      // Same-tab changes via CustomEvent
      const handleCustom = (e) => callback(e.detail);
      window.addEventListener(EVENT_PREFIX + storageKey, handleCustom);

      // Cross-tab changes via storage event
      const handleStorage = (e) => {
        if (e.key !== storageKey) return;
        // Can't determine exact change type from storage event, so trigger a generic update
        const items = readStore(storageKey);
        items.forEach(item => {
          callback({ type: 'update', id: item.id, data: item });
        });
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        window.removeEventListener(EVENT_PREFIX + storageKey, handleCustom);
        window.removeEventListener('storage', handleStorage);
      };
    },
  };
}
