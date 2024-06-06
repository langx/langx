import { Client, Databases, Query } from 'node-appwrite';

// event triggers
// databases.650750f16cd0c482bb83.collections.65103e2d3a6b4d9494c8.documents.*.update

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('Token Baseamount function called');

  try {
    return res.json({ ok: true });
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
