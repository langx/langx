import { Client, Databases, Query } from 'node-appwrite';

// event triggers
// databases.650750f16cd0c482bb83.collections.65103e2d3a6b4d9494c8.documents.*.update

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('Day streaks function called');
  log(req.body.name, req.body.$id);

  try {
    // Try to find the user in STREAKS_COLLECTION
    log('Searching for user in STREAKS_COLLECTION...');
    const userStreaks = await db.listDocuments(
      process.env.APP_DATABASE,
      process.env.STREAKS_COLLECTION,
      [Query.equal('$id', req.body.$id)]
    );

    log(userStreaks);

    if (userStreaks.total === 0) {
      // User not found in STREAKS_COLLECTION
      log('User not found, creating new document...');
      await db.createDocument(
        process.env.APP_DATABASE,
        process.env.STREAKS_COLLECTION,
        req.body.$id,
        { daystreak: 1, userId: req.body.$id }
      );
      log('New document created for user.');
      return res.json({
        ok: true,
        error: 'User is just created in STREAKS_COLLECTION',
      });
    } else {
      // User found, userStreaks.documents[0] contains the user's document
      log('User found in STREAKS_COLLECTION.');
      const userStreakDoc = userStreaks.documents[0];
      // Continue with your logic...

      // Calculate streak
      log('Calculating streak...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let lastActiveDate = new Date(req.body.lastSeen);
      lastActiveDate.setHours(0, 0, 0, 0);
      log('lastActiveDate');
      log(lastActiveDate);

      let lastStreakUpdated = new Date(userStreakDoc.$updatedAt);
      lastStreakUpdated.setHours(0, 0, 0, 0);
      log('lastStreakUpdated');
      log(lastStreakUpdated);

      log('today:');
      log(today);

      log('Checking if streak already updated today...');

      if (today.valueOf() === lastStreakUpdated.valueOf()) {
        error('Streak already updated today.');
        return res.json({
          ok: false,
          error: 'Streak already updated today',
        });
      }

      log('Streak not updated today.');

      const diffInDays = Math.round(
        (today.valueOf() - lastActiveDate.valueOf()) / (1000 * 60 * 60 * 24)
      );

      log('lastActiveDate.valueOf():');
      log(lastActiveDate.valueOf());

      log('today.valueOf():');
      log(today.valueOf());

      let streakCount = parseInt(userStreakDoc.daystreak);
      let newStreakCount = streakCount;

      log('diffInDays:');
      log(diffInDays);
      if (diffInDays <= 1) {
        newStreakCount++;
      } else if (diffInDays > 1) {
        newStreakCount = 1;
      }
      log('newStreakCount:');
      log(newStreakCount);
      log('streakCount:');
      log(streakCount);

      if (newStreakCount !== streakCount) {
        log('Updating streak count...');
        await db.updateDocument(
          process.env.APP_DATABASE,
          process.env.STREAKS_COLLECTION,
          req.body.$id,
          {
            daystreak: newStreakCount,
          }
        );
        log('Streak count updated.');
      }

      log('Streak calculation completed.');
      return res.json({
        ok: true,
        $id: req.body.$id,
        name: req.body.name,
        daystreak: newStreakCount,
      });
    }
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
