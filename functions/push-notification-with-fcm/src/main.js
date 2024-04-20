import { throwIfMissing, sendPushNotification, getFlagEmoji } from './utils.js';

import { Client, Users, Databases } from 'node-appwrite';

// Event trigger:
// databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create

export default async ({ req, res, log, error }) => {
  try {
    log(req);
    throwIfMissing(req.body, ['to', 'sender', 'roomId', 'type']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const type = req.body.type;
  const roomId = req.body.roomId.$id;

  switch (type) {
    case 'body':
      throwIfMissing(req.body, ['body']);
      break;
    case 'image':
      throwIfMissing(req.body, ['image']);
      break;
    case 'audio':
      throwIfMissing(req.body, ['audio']);
      break;
    default:
      // Send error response
      res.status(400).json({
        ok: false,
        error: 'type is not valid',
      });
      break;
  }

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
    req.body.sender
  );
  log(senderUserDoc);

  const toUserDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    req.body.to
  );
  log(toUserDoc);

  // Check if toUserDoc has notifications enabled
  if (!toUserDoc?.notificationsArray.includes('message')) {
    log('User has not enabled message notifications');
    return res.json(
      { ok: false, error: 'User has not enabled message notifications' },
      400
    );
  }

  // Uncomment this when production ready, check user is online or not
  const now = new Date();
  const lastSeen = new Date(toUserDoc?.lastSeen);
  if (now - lastSeen < 1000 * 5) {
    log(`User is still online: ${toUserDoc.name}`);
    return res.json({ ok: false, error: 'User is still online' }, 400);
  }

  // Check if user is blocked or not
  log(`Blocked Users: ${toUserDoc.blockedUsers} -- sender: ${req.body.sender}`);
  if (toUserDoc?.blockedUsers.includes(req.body.sender)) {
    return res.json({ ok: false, error: 'You are blocked by this user' }, 400);
  }
  log('-- User is not blocked');

  log(`Archived Rooms: ${toUserDoc.archivedRooms} -- roomId: ${roomId}`);
  if (toUserDoc?.archivedRooms.includes(roomId)) {
    return res.json({ ok: false, error: 'You are archived by this user' }, 400);
  }
  log('-- User is not archived');

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
    title: getFlagEmoji(senderUserDoc) + ' ' + senderUserDoc.name,
    body: null,
  };

  switch (type) {
    case 'body':
      notification.body = req.body.body;
      break;
    case 'image':
      notification.body = '📷 Image';
      break;
    case 'audio':
      notification.body = '🔊 Audio';
      break;
    default:
      // Send error response
      res.status(400).json({
        ok: false,
        error: 'type is not valid',
      });
      break;
  }

  try {
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
          $id: req.body.$id,
          roomId: roomId,
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
          roomId: roomId,
        },
        // Add Android-specific options here
        token: prefs['android'],
      });
      log(`Successfully sent Android message: ${response}`);
    }

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
          roomId: roomId,
        },
        // Add PWA-specific options here
        token: prefs['pwa'],
      });
      log(`Successfully sent PWA message: ${response}`);
    }

    return res.json({ ok: true });
  } catch (e) {
    error(e);
    return res.json({ ok: false, error: 'Failed to send the message' }, 500);
  }
};
