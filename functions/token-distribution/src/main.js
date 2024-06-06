import { Client, Databases, Query } from 'node-appwrite';

// Event Triggers
// + Messages Collection: databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create
// + Users Collection:    databases.650750f16cd0c482bb83.collections.65103e2d3a6b4d9494c8.documents.*.update

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  // log('Token Baseamount function called');

  try {
    switch (req.body.$collectionId) {
      case process.env.USERS_COLLECTION:
        log('Users Collection Triggered');
        // log(req.body);
        let tokenDocsFromUser = await db.listDocuments(
          process.env.APP_DATABASE,
          process.env.TOKEN_COLLECTION,
          [Query.equal('$id', req.body.$id)]
        );

        if (tokenDocsFromUser.total === 0) {
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
          tokenDocsFromUser = await db.listDocuments(
            process.env.APP_DATABASE,
            process.env.TOKEN_COLLECTION,
            [Query.equal('$id', req.body.$id)]
          );
        }

        const tokenDocFromUser = tokenDocsFromUser.documents[0];
        let updatedDocFromUser = {};
        log(tokenDocFromUser);

        //
        // Calculate lastSeen
        //
        let lastActiveDate = new Date(req.body.lastSeen);
        const lastSeenFromTokenDoc = new Date(tokenDocFromUser.lastSeen);
        const diffInSeconds =
          Math.abs(lastActiveDate - lastSeenFromTokenDoc) / 1000;
        log(`diffInSeconds: ${diffInSeconds}`);
        if (diffInSeconds >= 30 && diffInSeconds <= 90) {
          updatedDocFromUser.onlineMin = tokenDocFromUser.onlineMin + 1;
          log('onlineMin ++');
          updatedDocFromUser.lastSeen = req.body.lastSeen;
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

          if (tokenDocFromUser.badges !== badgesBonus) {
            updatedDocFromUser.badges = badgesBonus;
          }
        }

        //
        // Check Day Streaks
        //
        if (req.body.streaks.daystreak !== tokenDocFromUser.streak) {
          updatedDocFromUser.streak = req.body.streaks.daystreak;
        }

        log(`updatedDocFromUser: ${JSON.stringify(updatedDocFromUser)}`);

        if (Object.keys(updatedDocFromUser).length !== 0) {
          db.updateDocument(
            process.env.APP_DATABASE,
            process.env.TOKEN_COLLECTION,
            tokenDocFromUser.$id,
            updatedDocFromUser
          );
        }
        return res.json({ ok: true });
      case process.env.MESSAGES_COLLECTION:
        log('Messages Collection Triggered');
        log(req.body);

        let tokenDocsFromMessage = await db.listDocuments(
          process.env.APP_DATABASE,
          process.env.TOKEN_COLLECTION,
          [Query.equal('$id', req.body.sender)]
        );

        if (tokenDocsFromMessage.total === 0) {
          return res.json({
            ok: false,
            error: 'Token document not found from Message Collection Trigger',
          });
        }

        const tokenDocfromMessage = tokenDocsFromMessage.documents[0];
        let updatedDocFromMessage = {};
        log(tokenDocfromMessage);

        //
        // Check Message Type
        //

        switch (req.body.type) {
          case 'body':
            log('Message Type: Body');
            updatedDocFromMessage.text = tokenDocfromMessage.text + 1;
            break;
          case 'image':
            log('Message Type: Image');
            updatedDocFromMessage.image = tokenDocfromMessage.image + 1;
            break;
          case 'audio':
            updatedDocFromMessage.audio = tokenDocfromMessage.audio + 1;
            log('Message Type: Audio');
            break;
          default:
            log('Unknown Message Type');
            return res.json({ ok: true });
        }

        log(`updatedDocFromMessage: ${JSON.stringify(updatedDocFromMessage)}`);

        if (Object.keys(updatedDocFromMessage).length !== 0) {
          db.updateDocument(
            process.env.APP_DATABASE,
            process.env.TOKEN_COLLECTION,
            tokenDocfromMessage.$id,
            updatedDocFromMessage
          );
        }

        return res.json({ ok: true });
      default:
        log('Unknown Collection');
        return res.json({ ok: true });
    }
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
