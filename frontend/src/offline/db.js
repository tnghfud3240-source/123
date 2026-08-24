import { openDB } from "idb";

const DB_NAME = "snow-storage-offline";
const STORE = "pending_transactions";

export function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "client_id" });
      }
    },
  });
}

export async function addPending(tx) {
  const db = await getDb();
  await db.put(STORE, tx);
}

export async function getAllPending() {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function removePending(clientId) {
  const db = await getDb();
  await db.delete(STORE, clientId);
}

export async function countPending() {
  const db = await getDb();
  return db.count(STORE);
}

export const STORE_NAME = STORE;
