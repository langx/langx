import { Client, Databases, Query } from 'node-appwrite';

// Event Triggers
// + Messages Collection: databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create
// + Users Collection:    databases.650750f16cd0c482bb83.collections.65103e2d3a6b4d9494c8.documents.*.update
// + Streaks Collection:  databases.650750f16cd0c482bb83.collections.65e73985ef5ac00c186b.documents.*.update

/**
 * @typedef {Object} Token
 * @property {number} [image]
 * @property {number} [audio]
 * @property {number} [text]
 * @property {number} [onlineMin]
 * @property {number} [streak]
 * @property {number} [badges]
 * @property {number} [baseAmount]
 */

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('Token Baseamount function called');

  try {
    const tokenDoc = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.TOKEN_COLLECTION,
      req.body.$id
    );

    log(tokenDoc);

    switch (req.body.$collectionId) {
      case process.env.USERS_COLLECTION:
        log('Users Collection Triggered');
        log(req.body);
        if (tokenDoc.length === 0) {
          await db.createDocument(
            process.env.APP_DATABASE,
            process.env.TOKEN_COLLECTION,
            req.body.$id,

            {
              $id: req.body.$id,
            }
          );
        }
        log('New document created for user in token collection.');
        return res.json({ ok: true });
      case process.env.MESSAGES_COLLECTION:
        log('Messages Collection Triggered');
        return res.json({ ok: true });
      case process.env.STREAKS_COLLECTION:
        log('Streaks Collection Triggered');
        return res.json({ ok: true });
      default:
        log('Unknown Collection');
        break;
    }
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
