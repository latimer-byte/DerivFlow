import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged as firebaseOnAuthStateChanged, User, signInAnonymously as firebaseSignInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, getDocFromServer, Timestamp } from 'firebase/firestore';

// ... (config remains same)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase with defaults to avoid 'undefined' errors
let app: any;
let auth: any = {
  isMock: true,
  onAuthStateChanged: (cb: any) => () => {},
  currentUser: null,
  providerData: []
};
let db: any = {
  isMock: true,
  collection: () => ({ doc: () => ({}) }),
  doc: () => ({})
};
const googleProvider = new GoogleAuthProvider();

// Custom onAuthStateChanged that handles mock mode
export const onAuthStateChanged = (authInstance: any, callback: (user: User | null) => void) => {
  if (authInstance && typeof authInstance.onAuthStateChanged === 'function' && authInstance.isMock) {
    return authInstance.onAuthStateChanged(callback);
  }
  return firebaseOnAuthStateChanged(authInstance, callback);
};

// Check if we have a real looking Firebase config
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" && 
  firebaseConfig.apiKey.startsWith("AIza") &&
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

try {
  if (isFirebaseConfigured) {
    console.log("Firebase: Configuration detected. Attempting initialization...");
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully.");
  } else {
    console.warn("Firebase: Configuration missing or invalid (API Keys should start with 'AIza'). Using mock mode.");
  }
} catch (e) {
  console.error("Firebase: Initialization failed", e);
}

export { auth, db, googleProvider };

// Error Handling Utility
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}

// Auth Helpers
export const signInWithGoogle = async () => {
  try {
    if (auth?.isMock) {
      console.warn("Using mock Google sign-in");
      return { uid: 'mock-google-user', email: 'mock@example.com', displayName: 'Mock User' };
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = () => {
  if (auth?.isMock) return Promise.resolve();
  return signOut(auth);
};

export const signInAnonymously = async () => {
  try {
    if (auth?.isMock) {
      console.warn("Using mock anonymous sign-in");
      return { uid: 'mock-user-' + Math.random().toString(36).substring(7), isAnonymous: true };
    }
    const result = await firebaseSignInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Error signing in anonymously", error);
    throw error;
  }
};
