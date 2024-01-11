import { throwIfMissing, sendPushNotification } from './utils.js';

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

  try {
    log(senderUserDoc);
    throwIfMissing(senderUserDoc, ['lastSeen', 'name']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const toUserDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    req.body.to
  );

  try {
    log(toUserDoc);
    throwIfMissing(toUserDoc, ['lastSeen', 'name', 'totalUnseen']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  // Check if user is blocked or not
  // log(`Blocked Users: ${toUserDoc.blockedUsers} -- sender: ${req.body.sender}`);
  if (toUserDoc?.blockedUsers.includes(req.body.sender)) {
    return res.json({ ok: false, error: 'You are blocked by this user' }, 400);
  }

  // log(`Archived Rooms: ${toUserDoc.archivedRooms} -- roomId: ${roomId}`);
  if (toUserDoc?.archivedRooms.includes(roomId)) {
    return res.json({ ok: false, error: 'You are archived by this user' }, 400);
  }

  // Check token exists or not

  // Initialize flags
  let iosExists = false;
  let androidExists = false;

  // Check if iOS token exists
  try {
    throwIfMissing(prefs, ['ios']);
    iosExists = true;
  } catch (err) {
    console.log('iOS token missing');
  }

  // Check if Android token exists
  try {
    throwIfMissing(prefs, ['android']);
    androidExists = true;
  } catch (err) {
    console.log('Android token missing');
  }

  // If neither iOS nor Android token exists, return an error
  if (!iosExists && !androidExists) {
    return res.json(
      { ok: false, error: 'Both iOS and Android tokens are missing' },
      400
    );
  }

  log(prefs);

  // TODO: Uncomment this when production ready
  // Check user is online or not
  // const now = new Date();
  // const lastSeen = new Date(toUserDoc.lastSeen);
  // if (now - lastSeen < 1000 * 60 * 1) {
  //   log(`User is still online: ${toUserDoc.name}`);
  //   return res.json({ ok: false, error: 'User is online' }, 400);
  // }

  log(`Sending message to device: ${req.body.to}`);

  let notification = {
    title: senderUserDoc.name,
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
    if (iosExists) {
      const response = await sendPushNotification({
        notification: notification,
        data: {
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

    return res.json({ ok: true });
  } catch (e) {
    error(e);
    return res.json({ ok: false, error: 'Failed to send the message' }, 500);
  }
};
