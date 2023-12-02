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

  try {
    log(prefs);
    throwIfMissing(prefs, ['ios']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

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
    const response = await sendPushNotification({
      notification: notification,
      data: {
        roomId: req.body.roomId.$id,
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
    log(`Successfully sent message: ${response}`);

    return res.json({ ok: true, messageId: response });
  } catch (e) {
    error(e);
    return res.json({ ok: false, error: 'Failed to send the message' }, 500);
  }
};
