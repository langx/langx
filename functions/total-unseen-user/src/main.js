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
      Query.orderDesc('lastMessageUpdatedAt'),
    ];
    let querry2 = [
      Query.contains('users', user2),
      Query.orderDesc('lastMessageUpdatedAt'),
    ];

    // Push archived rooms to query
    user1Doc.archivedRooms?.forEach((id) => {
      querry1.push(Query.notEqual('$id', id));
    });
    user2Doc.archivedRooms?.forEach((id) => {
      querry2.push(Query.notEqual('$id', id));
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
      // Check if any user in room.users is blocked by user1
      if (room.users.some((user) => user1Doc.blockedUsers.includes(user))) {
        return;
      }

      if (room.users[0] === user1 && room.unseen[0] !== 0) {
        unseenCountUser1 += room.unseen[0];
      } else if (room.users[1] === user1 && room.unseen[1] !== 0) {
        unseenCountUser1 += room.unseen[1];
      }
    });

    // Count unseen messages for user2
    let unseenCountUser2 = 0;
    listRoomsForUser2.documents.forEach((room) => {
      // Check if any user in room.users is blocked by user1
      if (room.users.some((user) => user2Doc.blockedUsers.includes(user))) {
        return;
      }
      if (room.users[0] === user2 && room.unseen[0] !== 0) {
        unseenCountUser2 += room.unseen[0];
      } else if (room.users[1] === user2 && room.unseen[1] !== 0) {
        unseenCountUser2 += room.unseen[1];
      }
    });

    // log(`Unseen count for User 1: ${unseenCountUser1}`);
    // log(`Unseen count for User 2: ${unseenCountUser2}`);

    // Init queries
    let querry1archived = [
      Query.contains('users', user1),
      Query.orderDesc('lastMessageUpdatedAt'),
    ];
    let querry2archived = [
      Query.contains('users', user2),
      Query.orderDesc('lastMessageUpdatedAt'),
    ];

    let unseenArchivedCountUser1 = 0;
    let unseenArchivedCountUser2 = 0;

    // Include for archived rooms
    if (user1Doc.archivedRooms && user1Doc.archivedRooms.length > 0) {
      querry1archived.push(Query.contains('$id', user1Doc.archivedRooms));

      // List archived rooms
      const listArchivedRoomsForUser1 = await db.listDocuments(
        process.env.APP_DATABASE,
        process.env.ROOMS_COLLECTION,
        querry1archived
      );

      // Count unseen messages for user1 in archived rooms
      listArchivedRoomsForUser1.documents.forEach((room) => {
        // Check if any user in room.users is blocked by user1
        if (room.users.some((user) => user1Doc.blockedUsers.includes(user))) {
          return;
        }
        if (room.users[0] === user1 && room.unseen[0] !== 0) {
          unseenArchivedCountUser1 += room.unseen[0];
        } else if (room.users[1] === user1 && room.unseen[1] !== 0) {
          unseenArchivedCountUser1 += room.unseen[1];
        }
      });
    }

    if (user2Doc.archivedRooms && user2Doc.archivedRooms.length > 0) {
      querry2archived.push(Query.contains('$id', user2Doc.archivedRooms));

      const listArchivedRoomsForUser2 = await db.listDocuments(
        process.env.APP_DATABASE,
        process.env.ROOMS_COLLECTION,
        querry2archived
      );

      // Count unseen messages for user2 in archived rooms
      listArchivedRoomsForUser2.documents.forEach((room) => {
        // Check if any user in room.users is blocked by user1
        if (room.users.some((user) => user2Doc.blockedUsers.includes(user))) {
          return;
        }
        if (room.users[0] === user2 && room.unseen[0] !== 0) {
          unseenArchivedCountUser2 += room.unseen[0];
        } else if (room.users[1] === user2 && room.unseen[1] !== 0) {
          unseenArchivedCountUser2 += room.unseen[1];
        }
      });
    }

    // log(`Unseen count for User 1 Archived: ${unseenArchivedCountUser1}`);
    // log(`Unseen count for User 2 Archived: ${unseenArchivedCountUser2}`);

    log(`totalUnseen: User 1: ${user1Doc.totalUnseen}, ${unseenCountUser1}`);
    log(`totalUnseen: User 2: ${user2Doc.totalUnseen}, ${unseenCountUser2}`);
    log(
      `totalUnseenArchived: User 1: ${user1Doc.totalUnseenArchived}, ${unseenArchivedCountUser1}`
    );
    log(
      `totalUnseenArchived: User 2: ${user2Doc.totalUnseenArchived}, ${unseenArchivedCountUser2}`
    );

    // Update user documents with totalUnseen attribute
    let promises = [];

    if (
      user1Doc.totalUnseen !== unseenCountUser1 ||
      user1Doc.totalUnseenArchived !== unseenArchivedCountUser1
    ) {
      log(`Updating totalUnseen for User 1`);
      promises.push(
        updateUserTotalUnseen(
          db,
          user1,
          unseenCountUser1,
          unseenArchivedCountUser1
        )
      );
    }

    if (
      user2Doc.totalUnseen !== unseenCountUser2 ||
      user2Doc.totalUnseenArchived !== unseenArchivedCountUser2
    ) {
      log(`Updating totalUnseen for User 2`);
      promises.push(
        updateUserTotalUnseen(
          db,
          user2,
          unseenCountUser2,
          unseenArchivedCountUser2
        )
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return res.json({ ok: true });
  } catch (err) {
    log(`Error: ${err.message}`);
    return res.json({ ok: false, error: err.message }, 400);
  }
};

async function updateUserTotalUnseen(
  db,
  userId,
  totalUnseen,
  totalUnseenArchived
) {
  try {
    await db.updateDocument(
      process.env.APP_DATABASE,
      process.env.USERS_COLLECTION,
      userId,
      {
        totalUnseen: totalUnseen,
        totalUnseenArchived: totalUnseenArchived,
      }
    );
  } catch (err) {
    throw new Error(
      `Failed to update totalUnseen for User ${userId}: ${err.message}`
    );
  }
}
