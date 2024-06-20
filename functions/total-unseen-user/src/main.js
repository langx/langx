import { Client, Databases, Query } from 'node-appwrite';

// "events": [
//   "databases.650750f16cd0c482bb83.collections.6507510fc71f989d5d1c.documents.*.update"
// ],

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  try {
    log(`Request: ${JSON.stringify(req.body)}`);
    const user1 = req.body.users[0];
    const user2 = req.body.users[1];
    log(`Users: ${user1} and ${user2}`);

    // Get user documents
    const user1Doc = await db.getDocument(
      process.env.APP_DATABASE,
      process.env.USERS_COLLECTION,
      user1
    );
    const user2Doc = await db.getDocument(
      process.env.APP_DATABASE,
      process.env.USERS_COLLECTION,
      user2
    );

    // Init queries
    let querry1 = [
      Query.contains('users', user1),
      Query.orderDesc('$updatedAt'),
    ];
    let querry2 = [
      Query.contains('users', user2),
      Query.orderDesc('$updatedAt'),
    ];

    // Exclude archived rooms
    req.body.archived.forEach((userId) => {
      if (userId === user1) {
        querry1.push(Query.notEqual('$id', req.body.$id));
      }
      if (userId === user2) {
        querry2.push(Query.notEqual('$id', req.body.$id));
      }
    });

    const listRoomsForUser1 = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.ROOMS_COLLECTION,
      querry1
    );

    const listRoomsForUser2 = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.ROOMS_COLLECTION,
      querry2
    );

    // Count unseen messages for user1
    let unseenCountUser1 = 0;
    listRoomsForUser1.documents.forEach((room) => {
      if (room.users[0] === user1 && room.unseen[0] !== 0) {
        unseenCountUser1 += room.unseen[0];
      } else if (room.users[1] === user1 && room.unseen[1] !== 0) {
        unseenCountUser1 += room.unseen[1];
      }
    });

    // Count unseen messages for user2
    let unseenCountUser2 = 0;
    listRoomsForUser2.documents.forEach((room) => {
      if (room.users[0] === user2 && room.unseen[0] !== 0) {
        unseenCountUser2 += room.unseen[0];
      } else if (room.users[1] === user2 && room.unseen[1] !== 0) {
        unseenCountUser2 += room.unseen[1];
      }
    });

    log(`Unseen count for User 1: ${unseenCountUser1}`);
    log(`Unseen count for User 2: ${unseenCountUser2}`);

    // Update user documents with totalUnseen attribute
    await Promise.all([
      updateUserTotalUnseen(db, user1, unseenCountUser1),
      updateUserTotalUnseen(db, user2, unseenCountUser2),
    ]);

    return res.json({ ok: true });
  } catch (err) {
    log(`Error: ${err.message}`);
    return res.json({ ok: false, error: err.message }, 400);
  }
};

async function updateUserTotalUnseen(db, userId, totalUnseen) {
  try {
    await db.updateDocument(
      process.env.APP_DATABASE,
      process.env.USERS_COLLECTION,
      userId,
      {
        totalUnseen: totalUnseen,
      }
    );
  } catch (err) {
    throw new Error(
      `Failed to update totalUnseen for User ${userId}: ${err.message}`
    );
  }
}
