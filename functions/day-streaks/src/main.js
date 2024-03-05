import { Client, Databases } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  const userDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    req.body.to
  );

  try {
    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastActiveDate = new Date(userDoc.lastSeen);
    lastActiveDate.setHours(0, 0, 0, 0);

    const diffInDays = Math.round(
      (today.valueOf() - lastActiveDate.valueOf()) / (1000 * 60 * 60 * 24)
    );
    let streakCount = userDoc.streakCount || 0;
    let newStreakCount = streakCount;

    if (diffInDays === 1) {
      newStreakCount++;
    } else if (diffInDays > 1) {
      newStreakCount = 1;
    }

    if (newStreakCount !== streakCount) {
      await db.updateDocument(
        process.env.APP_DATABASE,
        process.env.USERS_COLLECTION,
        req.body.to,
        {
          streakCount: newStreakCount,
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
