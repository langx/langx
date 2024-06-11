import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';

// Cronjobs, every 24 hours
// "schedule": "0 0 * * *",

// Cronjobs, every 5 minute
// "schedule": "*/5 * * * *",

const TEST_DAILY_TOKEN = 10000;

async function processDocuments(
  db,
  offset = 0,
  totalBaseAmount = 0,
  allDocs = []
) {
  let queries = [
    Query.or([
      Query.greaterThan('text', 0),
      Query.greaterThan('image', 0),
      Query.greaterThan('audio', 0),
    ]),
    Query.orderDesc('streak'),
    Query.offset(offset),
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

    doc.baseAmount = parseFloat(
      (
        (imageMessages * 200 + voiceMessages * 100 + textMessages * 10) *
        (onlineTime / 120) *
        (streak / 10) *
        badgesBonus
      ).toFixed(2)
    );

    totalBaseAmount += doc.baseAmount;

    // Add the document to the allDocs array
    allDocs.push(doc);
  }

  // If there are more documents to process, call the function recursively with the new offset
  if (offset + result.documents.length < result.total) {
    await processDocuments(
      db,
      offset + result.documents.length,
      totalBaseAmount,
      allDocs
    );
  } else {
    // All documents have been processed, now update each document in the allDocs array with the distribution percentage
    for (let doc of allDocs) {
      let distributionPercentage = parseFloat(
        (doc.baseAmount / totalBaseAmount).toFixed(4)
      );
      // console.log(
      //   `${doc.$id} - ${doc.baseAmount} - ${distributionPercentage} = ${
      //     TEST_DAILY_TOKEN * distributionPercentage
      //   }`
      // );

      // Create or update the document in wallet collections

      const token = TEST_DAILY_TOKEN * distributionPercentage;

      const walletDoc = await db.listDocuments(
        process.env.APP_DATABASE,
        process.env.WALLET_COLLECTION,
        [Query.equal('$id', doc.$id)]
      );

      if (walletDoc.total === 0) {
        // Create new document
        await db.createDocument(
          process.env.APP_DATABASE,
          process.env.WALLET_COLLECTION,
          doc.$id,
          {
            balance: token,
          },
          [Permission.read(Role.user(doc.$id))]
        );
      } else {
        // Update existing document
        await db.updateDocument(
          process.env.APP_DATABASE,
          process.env.WALLET_COLLECTION,
          doc.$id,
          {
            balance: walletDoc.documents[0].balance + token,
          }
        );
      }

      await db.createDocument(
        process.env.APP_DATABASE,
        process.env.CHECKOUT_COLLECTION,
        ID.unique(),
        {
          userId: doc.$id,
          amount: token,
          distribution: distributionPercentage,
          baseAmount: doc.baseAmount,
          text: doc.text,
          image: doc.image,
          audio: doc.audio,
          streak: doc.streak,
          badges: doc.badges,
          onlineMin: doc.onlineMin,
          totalAmount: TEST_DAILY_TOKEN,
          date: new Date().toISOString(),
        },
        [Permission.read(Role.user(doc.$id))]
      );

      // Reset the tokenDoc after checking out
      await db.updateDocument(
        process.env.APP_DATABASE,
        process.env.TOKEN_COLLECTION,
        doc.$id,
        { text: 0, image: 0, audio: 0, onlineMin: 1 }
      );
    }
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
