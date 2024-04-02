import { Client, Databases } from 'node-appwrite';

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

  log(req);

  try {
    const body = JSON.parse(req.body);
    log(body);
    return res.json({ ok: true, error: null });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
