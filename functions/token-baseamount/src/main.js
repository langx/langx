import { Client, Databases, Query } from 'node-appwrite';

// Event Triggers
// + Messages Collection: databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create
// + Users Collection:    databases.650750f16cd0c482bb83.collections.65103e2d3a6b4d9494c8.documents.*.update
// + Streaks Collection:  databases.650750f16cd0c482bb83.collections.65e73985ef5ac00c186b.documents.*.update

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('Token Baseamount function called');

  try {
    const tokenDocs = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.TOKEN_COLLECTION,
      [Query.equal('$id', req.body.$id)]
    );

    log(tokenDocs);

    switch (req.body.$collectionId) {
      case process.env.USERS_COLLECTION:
        log('Users Collection Triggered');
        log(req.body);
        if (tokenDocs.total === 0) {
          // Create new token document for user
          const test = await db.createDocument(
            process.env.APP_DATABASE,
            process.env.TOKEN_COLLECTION,
            req.body.$id,
            {
              lastSeen: req.body.lastSeen,
              streak: req.body.streaks.daystreak,
            }
          );
          log('New document created for user.');
          return res.json({
            ok: true,
            message: 'New document created for user.',
          });
        }
        // User found, tokenDocs.documents[0] contains the user's document
        log('User found in token collection.');
        const tokenDoc = tokenDocs.documents[0];
        let updatedDoc = {};

        //
        // Calculate lastSeen
        //
        let lastActiveDate = new Date(req.body.lastSeen);
        const lastSeenFromTokenDoc = new Date(tokenDoc.lastSeen);
        const diffInSeconds =
          Math.abs(lastActiveDate - lastSeenFromTokenDoc) / 1000;
        log(`diffInSeconds: ${diffInSeconds}`);
        if (diffInSeconds >= 30 && diffInSeconds <= 90) {
          updatedDoc.onlineMin = tokenDoc.onlineMin + 1;
          log('onlineMin ++');
          updatedDoc.lastSeen = req.body.lastSeen;
        }

        //
        // Calculate Badges
        //
        let badgesBonus = 1;

        if (req.body.badges) {
          log(req.body.badges);
          // Add other badges bonuses
          if (req.body.badges.includes('fundamental')) badgesBonus *= 3;
          if (req.body.badges.includes('sponsor')) badgesBonus *= 2;
          if (req.body.badges.includes('early-adopter')) badgesBonus *= 1.5;
          if (req.body.badges.includes('pioneer')) badgesBonus *= 1.2;
          if (req.body.badges.includes('teacher')) badgesBonus *= 1.1;
          if (req.body.badges.includes('creator')) badgesBonus *= 1.1;

          // Limit the maximum bonus to 10
          badgesBonus = Math.min(10, badgesBonus);

          if (tokenDoc.badges !== badgesBonus) {
            updatedDoc.badges = badgesBonus;
          }
        }

        //
        // Check Day Streaks
        //
        if (req.body.streaks.daystreak !== tokenDoc.streak) {
          updatedDoc.streak = req.body.streaks.daystreak;
        }

        log(`updatedDoc: ${JSON.stringify(updatedDoc)}`);

        if (Object.keys(updatedDoc).length !== 0) {
          db.updateDocument(
            process.env.APP_DATABASE,
            process.env.TOKEN_COLLECTION,
            tokenDoc.$id,
            updatedDoc
          );
        }
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
