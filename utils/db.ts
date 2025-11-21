
import { Theme, Wallpaper } from '../types';
import { getSessionKey } from './sessionKey';
import { encrypt, decrypt } from './crypto';

const DB_NAME = 'FinanSysProDB';
const DB_VERSION = 7; // Incremented version for new indexes

export const STORE_NAMES = {
    SETTINGS: 'settings',
    TRANSACTIONS: 'transactions',
    BOLETOS: 'boletos',
    FATURAMENTOS: 'faturamentos',
    FATURAMENTOS_SEM_NOTA: 'faturamentos_sem_nota',
    CATEGORIES: 'categories',
    USERS: 'users',
};

const ENCRYPTED_STORES = [
    STORE_NAMES.SETTINGS,
    STORE_NAMES.TRANSACTIONS,
    STORE_NAMES.BOLETOS,
    STORE_NAMES.FATURAMENTOS,
    STORE_NAMES.FATURAMENTOS_SEM_NOTA,
    STORE_NAMES.CATEGORIES,
];

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Erro ao abrir o BD', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const dbInstance = (event.target as IDBOpenDBRequest).result;
                const transaction = (event.target as IDBOpenDBRequest).transaction;

                Object.values(STORE_NAMES).forEach(storeName => {
                    if (!dbInstance.objectStoreNames.contains(storeName)) {
                        dbInstance.createObjectStore(storeName, { keyPath: 'id' });
                    }
                });

                // Create compound indexes for efficient querying
                if (transaction) {
                    const storesForCompoundIndex = {
                        [STORE_NAMES.TRANSACTIONS]: 'date',
                        [STORE_NAMES.BOLETOS]: 'date',
                        [STORE_NAMES.FATURAMENTOS]: 'data',
                        [STORE_NAMES.FATURAMENTOS_SEM_NOTA]: 'data',
                    };

                    for (const [storeName, dateField] of Object.entries(storesForCompoundIndex)) {
                        const store = transaction.objectStore(storeName);
                        const indexName = 'companyId_date';
                        if (store.indexNames.contains('companyId')) store.deleteIndex('companyId');
                        if (!store.indexNames.contains(indexName)) {
                            store.createIndex(indexName, ['companyId', dateField]);
                        }
                    }
                    
                    const categoryStore = transaction.objectStore(STORE_NAMES.CATEGORIES);
                    if (!categoryStore.indexNames.contains('companyId')) {
                        categoryStore.createIndex('companyId', 'companyId', { unique: false });
                    }
                }
            };
        });
    }
    return dbPromise;
};

export async function query<T>({
  storeName,
  indexName,
  keyRange,
  direction,
  filter,
}: {
  storeName: string;
  indexName?: string;
  keyRange?: IDBKeyRange;
  direction?: IDBCursorDirection;
  filter?: (item: T) => boolean;
}): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    const request = source.openCursor(keyRange, direction);
    const results: T[] = [];
    const sessionKey = getSessionKey();
    const shouldDecrypt = sessionKey && ENCRYPTED_STORES.includes(storeName);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        let item = cursor.value;
        const processItem = (decryptedItem: T) => {
          if (!filter || filter(decryptedItem)) {
            results.push(decryptedItem);
          }
          cursor.continue();
        };

        if (shouldDecrypt && typeof (item as any).payload === 'string') {
          decrypt(item, sessionKey!).then(processItem).catch(e => {
            console.error('Failed to decrypt item during query', e);
            cursor.continue(); // Skip corrupted/undecryptable item
          });
        } else {
          processItem(item);
        }
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export const getItem = async <T>(storeName: string, id: string): Promise<T | undefined> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = async () => {
            const item = request.result;
            const key = getSessionKey();
            if (key && item && ENCRYPTED_STORES.includes(storeName)) {
                try {
                    if (typeof (item as any).payload !== 'string') {
                        putItem(storeName, item).catch(err => console.warn(`Falha ao auto-criptografar item antigo em ${storeName}`, err));
                        resolve(item);
                    } else {
                        const decrypted = await decrypt(item, key);
                        resolve(decrypted);
                    }
                } catch(error) {
                    reject(error);
                }
            } else {
                resolve(item);
            }
        };
        request.onerror = (e) => {
            console.error(`Erro ao obter item de ${storeName}:`, request.error);
            reject(request.error);
        };
    });
};

export const putItem = async <T extends {id: any}>(storeName: string, item: T): Promise<void> => {
    const db = await getDb();
    const key = getSessionKey();
    let itemToPut = item;

    if (key && ENCRYPTED_STORES.includes(storeName)) {
        itemToPut = await encrypt(item, key);
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(itemToPut);

        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const deleteItem = async (storeName: string, id: string): Promise<void> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const clearStore = async (storeName: string): Promise<void> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const bulkPutItems = async <T extends {id: any}>(storeName: string, items: T[]): Promise<void> => {
    if (items.length === 0) return Promise.resolve();

    const db = await getDb();
    const key = getSessionKey();
    const shouldEncrypt = key && ENCRYPTED_STORES.includes(storeName);

    let itemsToPut = items;
    if (shouldEncrypt) {
        itemsToPut = await Promise.all(items.map(item => encrypt(item, key!)));
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = () => {
            console.error("Erro na transação de inserção em massa:", transaction.error);
            reject(transaction.error);
        };
        
        itemsToPut.forEach(item => store.put(item));
    });
};

// This is kept for the User store which is not company-specific
export const getAllItems = async <T extends { id: any }>(storeName: string): Promise<T[]> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = async () => {
            const items = request.result;
             const sessionKey = getSessionKey();
            if (sessionKey && items.length > 0 && ENCRYPTED_STORES.includes(storeName)) {
                 try {
                    const decryptedItems: T[] = [];
                    const itemsToReencrypt: T[] = [];
                    
                    for (const item of items) {
                        if (typeof (item as any).payload !== 'string') {
                            decryptedItems.push(item);
                            itemsToReencrypt.push(item);
                        } else {
                            const decrypted = await decrypt(item, sessionKey);
                            decryptedItems.push(decrypted);
                        }
                    }

                    if (itemsToReencrypt.length > 0) {
                        bulkPutItems(storeName, itemsToReencrypt).catch(err => {
                            console.warn(`Falha ao auto-criptografar dados antigos em ${storeName}`, err);
                        });
                    }
                    resolve(decryptedItems);
                } catch (error) {
                    reject(error);
                }
            } else {
                resolve(items);
            }
        };
        request.onerror = (e) => {
             console.error(`Erro ao obter todos os itens de ${storeName}:`, request.error);
            reject(request.error);
        };
    });
};

export interface DBSettings {
  id: 'userSettings';
  theme: Theme;
  accentColor: string;
  wallpaper: Wallpaper;
}
