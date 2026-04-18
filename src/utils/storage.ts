import localforage from 'localforage';

// Isolated IndexedDB instance for ride state
const rideForage = localforage.createInstance({
  name: 'BicaDriver',
  storeName: 'ride_state',
});

// Isolated IndexedDB instance for auth state (moves auth out of plaintext localStorage)
const authForage = localforage.createInstance({
  name: 'BicaDriver',
  storeName: 'auth_state',
});

const makeForageStorage = (instance: LocalForage) => ({
  getItem: async (name: string) => {
    const value = await instance.getItem(name);
    return value ? JSON.stringify(value) : null;
  },
  setItem: async (name: string, value: string) => {
    await instance.setItem(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await instance.removeItem(name);
  },
});

export const rideForageStorage = makeForageStorage(rideForage);
export const authForageStorage = makeForageStorage(authForage);
