import { throwIfMissing } from './utils.js';
import {
  Client,
  Databases,
  Account,
  ID,
  Permission,
  Role,
} from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  try {
    log(`req: ${JSON.stringify(req)}`);
    throwIfMissing(req.headers, ['x-appwrite-user-id', 'x-appwrite-user-jwt']);
    const body = JSON.parse(req.bodyRaw);
    throwIfMissing(body, ['to']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const body = JSON.parse(req.bodyRaw);
  log(`body: ${JSON.stringify(body)}`);

  // TODO: #237 #SECURITY: VERIFY USER WITH JWT
  // START: VERIFY USER WITH JWT
  /*
  try {
    const verifyUser = new Client()
      .setEndpoint(process.env.APP_ENDPOINT)
      .setProject(process.env.APP_PROJECT)
      .setJWT(req.headers['x-appwrite-user-jwt']);

    const account = new Account(verifyUser);
    const user = await account.get();
    log(`user: ${JSON.stringify(user)}`);

    if (user.$id === req.headers['x-appwrite-user-id']) {
      log('jwt is valid');
    } else {
      log('jwt is invalid');
      return res.json({ ok: false, error: 'jwt is invalid' }, 400);
    }
  } catch (err) {
    log('jwt is invalid');
    return res.json({ ok: false, error: err.message }, 400);
  }
  */
  // END: VERIFY USER WITH JWT

  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const database = new Databases(client);

  // Create a room
  let roomData = { users: [req.headers['x-appwrite-user-id'], body.to] };
  let room = await database.createDocument(
    process.env.APP_DATABASE,
    process.env.ROOMS_COLLECTION,
    ID.unique(),
    roomData,
    [
      Permission.read(Role.user(req.headers['x-appwrite-user-id'])),
      Permission.read(Role.user(body.to)),
    ]
  );
  log(room);

  return res.json(room);
};
