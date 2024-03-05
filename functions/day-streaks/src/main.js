import { Client, Databases } from 'node-appwrite';

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
    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastActiveDate = new Date(req.body.lastSeen);
    lastActiveDate.setHours(0, 0, 0, 0);

    const diffInDays = Math.round(
      (today.valueOf() - lastActiveDate.valueOf()) / (1000 * 60 * 60 * 24)
    );
    let streakCount = parseInt(req.body.streakCount) || 0;
    let newStreakCount = streakCount;

    log(typeof streakCount);
    log(streakCount);
    log(typeof newStreakCount);
    log(newStreakCount);

    if (diffInDays === 1) {
      newStreakCount++;
    } else if (diffInDays > 1) {
      newStreakCount = 1;
    }

    if (newStreakCount !== streakCount) {
      await db.updateDocument(
        process.env.APP_DATABASE,
        process.env.USERS_COLLECTION,
        req.body.$id,
        {
          streakCount: newStreakCount,
          lastSeen: new Date().toISOString(),
        }
      );
    }

    return res.json({
      ok: true,
      $id: req.body.to,
      lastActiveDate: today.toISOString(),
      streakCount: newStreakCount,
    });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
