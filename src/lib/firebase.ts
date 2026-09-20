import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const storage = getStorage(app);

// ID do banco Firestore oficial do projeto
export const DATABASE_ID =
  firebaseConfig.firestoreDatabaseId || 'ai-studio-deliverysaasplat-fc259f71-8c58-4bc2-b2d2-2986291f82e8';

// Inicialização única do Firestore com suporte a ignorar campos undefined
export const db = initializeFirestore(
  app,
  {
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
  },
  DATABASE_ID
);

// Connectivity validation check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration or internet connection.');
    }
  }
}
testConnection();

export default app;

