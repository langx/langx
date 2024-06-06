import { Client, Databases, Query } from 'node-appwrite';

// Cronjobs, every 24 hours
// "schedule": "0 0 * * *",

// Cronjobs, every minute
// "schedule": "*/1 * * * *",

async function processDocuments(db, offset = 0) {
  let queries = [
    Query.or([
      Query.greaterThan('text', 0),
      Query.greaterThan('image', 0),
      Query.greaterThan('audio', 0),
    ]),
    Query.orderDesc('streak'),
    Query.offset(offset),
    Query.limit(5),
  ];

  const result = await db.listDocuments(
    process.env.APP_DATABASE,
    process.env.TOKEN_COLLECTION,
    queries
  );

  // Make a calculation for the base amount
  for (let doc of result.documents) {
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

    // Update the document with the new baseAmount and reset all values
    await db.updateDocument(
      process.env.APP_DATABASE,
      process.env.TOKEN_COLLECTION,
      doc.$id,
      { baseAmount: doc.baseAmount }
      // { baseAmount: doc.baseAmount, text: 0, image: 0, audio: 0, onlineMin: 1 }
    );
  }

  // If there are more documents to process, call the function recursively with the new offset
  if (offset + result.documents.length < result.total) {
    await processDocuments(db, offset + result.documents.length);
  }
}

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

    await processDocuments(db);

    log(`All documents processed.`);
    return res.json({ ok: true });
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
