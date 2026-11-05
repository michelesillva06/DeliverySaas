import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

// FCM VAPID Key: Needs to be configured in Firebase Console
// Placeholder for now, FCM usually needs this
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'; 

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function requestNotificationPermission(customerUid: string): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token) {
        await saveTokenToFirestore(customerUid, token);
        return token;
      }
    }
  } catch (error) {
    console.error('Erro ao solicitar permissão de notificação:', error);
  }
  return null;
}

async function saveTokenToFirestore(customerUid: string, token: string) {
  const tokenRef = doc(db, 'fcm_tokens', token);
  await setDoc(tokenRef, {
    customerUid,
    token,
    updatedAt: new Date().toISOString(),
  });
}
