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
      Query.limit(5),
    ];

    const result = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.TOKEN_COLLECTION,
      queries
    );

    // Make a calculation for the base amount
    result.documents.forEach(async (doc) => {
      let imageMessages = doc.image > 5 ? 5 : doc.image;
      let voiceMessages = doc.audio > 10 ? 10 : doc.audio;
      let textMessages = doc.text > 100 ? 100 : doc.text;
      let onlineTime = doc.onlineMin > 120 ? 120 : doc.onlineMin;
      let streak = doc.streak > 30 ? 30 : doc.streak;
      const badgesBonus = doc.badges;

      doc.baseAmount =
        (imageMessages * 200 + voiceMessages * 100 + textMessages * 10) *
        (onlineTime / 120) *
        (streak / 10) *
        badgesBonus;

      // Update the document with the new baseAmount
      await db.updateDocument(
        process.env.APP_DATABASE,
        process.env.TOKEN_COLLECTION,
        doc.$id,
        { baseAmount: doc.baseAmount }
      );

      log(`doc: ${JSON.stringify(doc)}`);
    });
    log(`result: ${JSON.stringify(result)}`);
    return res.json({ ok: true });
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
