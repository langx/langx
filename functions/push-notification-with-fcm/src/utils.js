import admin from 'firebase-admin';
import googleServices from './google-services.json' assert { type: 'json' };

/**
 * Throws an error if any of the keys are missing from the object
 * @param {*} obj
 * @param {string[]} keys
 * @throws {Error}
 */
export function throwIfMissing(obj, keys) {
  const missing = [];
  for (let key of keys) {
    if (!(key in obj) || !obj[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * @param {admin.messaging.Message} payload
 * @returns {Promise<string>}
 */
export async function sendPushNotification(payload) {
  admin.initializeApp({
    credential: admin.credential.cert(googleServices),
    databaseURL: process.env.FCM_DATABASE_URL,
  });
  return await admin.messaging().send(payload);
}
