import { throwIfMissing } from './utils.js';

import { Client, Users, Databases, Functions } from 'node-appwrite';

// Event trigger:
// databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create

export default async ({ req, res, log, error }) => {
  try {
    log(req);
    throwIfMissing(req.body, ['to', 'sender', 'roomId', 'type', 'body']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const type = req.body.type;
  const roomId = req.body.roomId.$id;

  if (type !== 'body' || req.body.body === null) {
    return res.json(
      { ok: false, error: 'Only body type messages are processed' },
      400
    );
  }

  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);
  const functions = new Functions(client);

  const toUserDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    req.body.to
  );
  log(toUserDoc);

  // Check if userDoc.badges has "early-adopter"
  if (!toUserDoc.badges.includes('early-adopter')) {
    log('User is not an early adopter');
    return res.json({ ok: false, error: 'User is not an early adopter' }, 400);
  }

  const roomDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.ROOMS_COLLECTION,
    roomId
  );
  log(roomDoc);

  // Check if roomDoc.copilot includes this userId
  if (!roomDoc.copilot.includes(req.body.sender)) {
    log('User is not part of copilot in this room');
    return res.json(
      { ok: false, error: 'User is not part of copilot in this room' },
      400
    );
  }

  // Trigger the copilot function
  try {
    const response = await functions.createExecution(
      'copilot',
      JSON.stringify({
        message: req.body.body,
      })
    );
    log(`Successfully triggered copilot function: ${response}`);
    return res.json({ ok: true });
  } catch (e) {
    error(`Failed to trigger copilot function: ${e.message}`);
    return res.json(
      { ok: false, error: 'Failed to trigger copilot function' },
      500
    );
  }
};
