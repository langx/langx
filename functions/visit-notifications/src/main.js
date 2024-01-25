import { throwIfMissing, sendPushNotification } from './utils.js';

import { Client, Users, Databases } from 'node-appwrite';

// Event trigger:
// databases.650750f16cd0c482bb83.collections.659dfb10b82eedbe1d6c.documents.*.create

export default async ({ req, res, log, error }) => {
  try {
    log(req);
    throwIfMissing(req.body, ['to', 'from']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const to = req.body.to;
  const sender = req.body.from.$id;

  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const users = new Users(client);
  const db = new Databases(client);

  const prefs = await users.getPrefs(req.body.to);

  // Check if lastSeen and name exists
  const senderUserDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    sender
  );
  log(senderUserDoc);

  const toUserDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    to
  );
  log(toUserDoc);

  // Check if toUserDoc has notifications enabled
  if (!toUserDoc?.notificationsArray.includes('visit')) {
    log('User has not enabled visit notifications');
    return res.json(
      { ok: false, error: 'User has not enabled visit notifications' },
      400
    );
  }

  // Check if user is blocked or not
  log(`Blocked Users: ${toUserDoc.blockedUsers} -- from: ${sender}`);
  if (toUserDoc?.blockedUsers.includes(sender)) {
    return res.json({ ok: false, error: 'You are blocked by this user' }, 400);
  }
  log('-- User is not blocked');

  // Check token exists or not

  // Initialize flags
  let iosExists = false;
  let androidExists = false;
  let pwaExists = false;

  // Check if iOS token exists
  try {
    throwIfMissing(prefs, ['ios']);
    iosExists = true;
    log(`iOS token exists: ${prefs['ios']}`);
  } catch (err) {
    log('iOS token missing');
  }

  // Check if Android token exists
  try {
    throwIfMissing(prefs, ['android']);
    androidExists = true;
    log(`Android token exists: ${prefs['android']}`);
  } catch (err) {
    log('Android token missing');
  }

  // Check if PWA token exists
  try {
    throwIfMissing(prefs, ['pwa']);
    pwaExists = true;
    log(`PWA token exists: ${prefs['pwa']}`);
  } catch (err) {
    log('PWA token missing');
  }

  // If neither iOS nor Android and PWA token exists, return an error
  if (!iosExists && !androidExists && !pwaExists) {
    return res.json(
      { ok: false, error: 'Tokens for iOS, Android, and PWA are missing' },
      400
    );
  }

  log(`Sending message to user: ${req.body.to}`);

  let notification = {
    title: senderUserDoc.name,
    body: 'visiting your profile.',
  };

  try {
    if (pwaExists) {
      // Check user is allowed notifications in user.notifications.includes('pwa')
      if (
        !toUserDoc ||
        !toUserDoc.notifications ||
        !toUserDoc.notifications.includes('pwa')
      ) {
        log('user is not allowed pwa notification in settings');
        return res.json({
          ok: false,
          error: 'User is disabled pwa notifications in settings',
        });
      }

      const response = await sendPushNotification({
        notification: notification,
        data: {
          userId: sender,
        },
        // Add PWA-specific options here
        token: prefs['pwa'],
      });
      log(`Successfully sent PWA message: ${response}`);
    }

    // Check user is allowed notifications in user.notifications.includes('pwa')
    if (
      !toUserDoc ||
      !toUserDoc.notifications ||
      !toUserDoc.notifications.includes('push')
    ) {
      log('user is not allowed push notification in settings');
      return res.json({
        ok: false,
        error: 'User is disabled push notifications in settings',
      });
    }

    if (iosExists) {
      const response = await sendPushNotification({
        notification: notification,
        data: {
          userId: sender,
        },
        apns: {
          payload: {
            aps: {
              badge: toUserDoc.totalUnseen + 1,
              sound: 'bingbong.aiff',
            },
          },
        },
        token: prefs['ios'],
      });
      log(`Successfully sent iOS message: ${response}`);
    }

    if (androidExists) {
      const response = await sendPushNotification({
        notification: notification,
        data: {
          userId: sender,
        },
        // Add Android-specific options here
        token: prefs['android'],
      });
      log(`Successfully sent Android message: ${response}`);
    }

    return res.json({ ok: true });
  } catch (e) {
    error(e);
    return res.json({ ok: false, error: 'Failed to send the message' }, 500);
  }
};
