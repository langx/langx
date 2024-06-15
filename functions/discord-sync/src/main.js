import { Client, Databases } from 'node-appwrite';

// execute permission
// users

export default async ({ req, res, log, error }) => {
  // Init SDK
  // const client = new Client()
  //   .setEndpoint(process.env.APP_ENDPOINT)
  //   .setProject(process.env.APP_PROJECT)
  //   .setKey(process.env.API_KEY);

  // const db = new Databases(client);

  const userDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    req.body.to
  );

  try {
    log(req.body);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
