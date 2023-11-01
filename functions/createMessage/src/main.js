import { throwIfMissing } from './utils.js';
import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  try {
    log(`req: ${JSON.stringify(req)}`);
    throwIfMissing(req.headers, ['x-appwrite-user-id']);
    const body = JSON.parse(req.bodyRaw);
    throwIfMissing(body, ['to', 'body', 'roomId']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const body = JSON.parse(req.bodyRaw);
  log(`body: ${JSON.stringify(body)}`);

  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const database = new Databases(client);

  // Create a message
  let messageData = {
    sender: req.headers['x-appwrite-user-id'],
    roomId: body.roomId,
    body: body.body,
    to: body.to,
  };

  let message = await database.createDocument(
    process.env.APP_DATABASE,
    process.env.MESSAGES_COLLECTION,
    ID.unique(),
    messageData,
    [
      Permission.read(Role.user(body.to)),
      Permission.read(Role.user(req.headers['x-appwrite-user-id'])),
      Permission.update(Role.user(req.headers['x-appwrite-user-id'])),
      Permission.delete(Role.user(req.headers['x-appwrite-user-id'])),
    ]
  );
  log(message);

  return res.json(message);
};
