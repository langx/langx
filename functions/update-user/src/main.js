import { Client, Databases } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('Update User function called');
  log(req.body);

  try {
    return res.json({ ok: true, error: null });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
