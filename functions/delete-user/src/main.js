import { Client, Databases, Query } from 'node-appwrite';

// Event Triggers
// "events": [
//   "databases.650750f16cd0c482bb83.collections.65103e2d3a6b4d9494c8.documents.*.delete"
// ],

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('delete-user function called');
  log(req.body);

  try {
    const userId = req.body.$id;
    log(userId);

    let rooms = [];
    let offset = 0;
    const limit = 25;
    let total = 0;
    let response;

    while (true) {
      response = await db.listDocuments(
        process.env.APP_DATABASE,
        process.env.ROOMS_COLLECTION,
        [
          Query.contains('users', userId),
          Query.orderAsc('$createdAt'),
          Query.limit(limit),
          Query.offset(offset),
        ]
      );

      rooms = rooms.concat(response.documents);
      total = response.total;
      offset += limit;

      if (rooms.length >= total) break;
    }

    log(rooms);

    // Update each room document to clear permissions concurrently
    await Promise.all(
      rooms.map((room) =>
        db.updateDocument(
          process.env.APP_DATABASE,
          process.env.ROOMS_COLLECTION,
          room.$id,
          {},
          [] // Clear permissions
        )
      )
    );

    log(`Total rooms found and updated for user ${userId}: ${rooms.length}`);

    return res.json({ ok: true, rooms });
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
