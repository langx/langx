import { Client, Databases, Account } from 'node-appwrite';

import { throwIfMissing } from './utils.js';

export default async ({ req, res, log, error }) => {
  log('Update User function called');

  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  throwIfMissing(req, ['body']);
  throwIfMissing(req.headers, ['x-appwrite-user-id', 'x-appwrite-user-jwt']);

  const user = req.headers['x-appwrite-user-id'];
  const jwt = req.headers['x-appwrite-jwt'];

  try {
    // Check JWT
    const verifyUser = new Client()
      .setEndpoint(env.APP_ENDPOINT)
      .setProject(env.APP_PROJECT)
      .setJWT(jwt);

    const account = new Account(verifyUser);
    const verifiedUser = await account.get();
    // console.log(`user: ${JSON.stringify(user)}`);

    if (verifiedUser.$id !== sender) {
      return res.status(400).json({ ok: false, error: 'jwt is invalid' });
    }
    
    const body = JSON.parse(req.body);
    log(body);
    return res.json({ ok: true, error: null });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
};
