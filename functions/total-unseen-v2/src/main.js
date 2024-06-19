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

    // define unseen
    let unseen = [0, 0];

    listMessages.documents.forEach(async (message) => {
      if (!message.seen) {
        if (message.to > message.sender) {
          unseen[0] += 1;
        } else {
          unseen[1] += 1;
        }
      }
    });

    log(`before: ${req.body.roomId.unseen}, after:${unseen}`);
    if (unseen.toString() !== req.body.roomId.unseen.toString()) {
      log('Updating unseen');
      const updatedRoom = await db.updateDocument(
        process.env.APP_DATABASE,
        process.env.ROOMS_COLLECTION,
        req.body.roomId.$id,
        {
          unseen: unseen,
        }
      );
      log(`Room Updated: ${JSON.stringify(updatedRoom)}`);
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
