/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const rtdb = admin.database();

exports.onUserStatusChanged = functions.database
  .ref("/users/{userId}")
  .onUpdate((event, context) => {
    const uid = context.params.userId;
    const usersRef = db.collection('users').doc(uid);

    rtdb.ref(`/users/${uid}`).on('value', function(snapshot) {
      if (snapshot.val().connections) {
        usersRef.update({
          online: true
        });
        return;
      } else {
        usersRef.update({
          online: false,
          lastSeen: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
    });
  });