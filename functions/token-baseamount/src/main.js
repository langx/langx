import { Client, Databases, Query } from 'node-appwrite';

// Cronjobs, every 1 minute
// "schedule": "*/1 * * * *",

export default async ({ req, res, log, error }) => {
  try {
    // Log start of function
    log('Token Baseamount function called');

    // Init SDK
    const client = new Client()
      .setEndpoint(process.env.APP_ENDPOINT)
      .setProject(process.env.APP_PROJECT)
      .setKey(process.env.API_KEY);

    const db = new Databases(client);

    let queries = [
      Query.or([
        Query.greaterThan('text', 0),
        Query.greaterThan('image', 0),
        Query.greaterThan('audio', 0),
      ]),
      Query.orderDesc('streak'),
    ];

    const result = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.TOKEN_COLLECTION,
      queries
    );

    log(`result: ${JSON.stringify(result)}`);
    return res.json({ ok: true });
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
