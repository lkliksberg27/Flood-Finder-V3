import { db } from './firebaseClient';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// Convert Firestore Timestamps to ISO strings so the rest of the app works
function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate().toISOString();
    }
  }
  return result;
}

function createEntity(collectionName) {
  const colRef = collection(db, collectionName);

  return {
    async list(sortParam) {
      let q;
      if (sortParam && sortParam.startsWith('-')) {
        const field = sortParam.slice(1);
        q = query(colRef, orderBy(field, 'desc'));
      } else if (sortParam) {
        q = query(colRef, orderBy(sortParam));
      } else {
        q = colRef;
      }

      try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => convertTimestamps({ id: d.id, ...d.data() }));
      } catch (e) {
        // If orderBy fails (missing index), fallback to unordered
        if (sortParam) {
          const snapshot = await getDocs(colRef);
          return snapshot.docs.map(d => convertTimestamps({ id: d.id, ...d.data() }));
        }
        throw e;
      }
    },

    async create(data) {
      const docRef = await addDoc(colRef, {
        ...data,
        created_date: serverTimestamp(),
      });
      return { id: docRef.id, ...data };
    },

    async update(id, data) {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, data);
      return { id, ...data };
    },

    async delete(id) {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      return { id };
    },

    subscribe(callback) {
      let initialLoad = true;
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        // Skip the initial snapshot (all docs come as 'added') to avoid duplicate refetches
        if (initialLoad) {
          initialLoad = false;
          return;
        }
        snapshot.docChanges().forEach((change) => {
          const data = convertTimestamps({ id: change.doc.id, ...change.doc.data() });
          if (change.type === 'added') {
            callback({ type: 'create', id: data.id, data });
          } else if (change.type === 'modified') {
            callback({ type: 'update', id: data.id, data });
          } else if (change.type === 'removed') {
            callback({ type: 'delete', id: data.id, data });
          }
        });
      });
      return unsubscribe;
    },
  };
}

export const entities = {
  Sensor: createEntity('sensors'),
  WatchedLocation: createEntity('watchedLocations'),
  Course: createEntity('courses'),
  Settings: createEntity('settings'),
};
