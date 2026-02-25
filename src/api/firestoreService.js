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
} from 'firebase/firestore';

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

      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() };
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
