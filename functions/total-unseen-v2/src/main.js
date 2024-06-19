import { Client, Databases, Query } from 'node-appwrite';

// "events": [
//   "databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create",
//   "databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.update"
// ],

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  try {
    const listMessages = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.MESSAGES_COLLECTION,
      [
        Query.equal('roomId', req.body.roomId.$id),
        Query.orderDesc('$createdAt'),
      ]
    );
    log(req);
    log(listMessages);

    const user1 = req.body.sender;
    const user2 = req.body.to;

    let unseen = {
      [user1]: 0,
      [user2]: 0,
    };

    listMessages.documents.forEach(async (message) => {
      if (!message.seen) {
        unseen[message.to]++;
      }
    });

    if (JSON.stringify(unseen) !== req.body.unseen) {
      log('Updating unseen');
      const updatedRoom = await db.updateDocument(
        process.env.APP_DATABASE,
        process.env.ROOMS_COLLECTION,
        req.body.roomId.$id,
        {
          unseen: JSON.stringify(unseen),
        }
      );
      log(updatedRoom);
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
