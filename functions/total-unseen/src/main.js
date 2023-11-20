import { Client, Databases } from 'node-appwrite';

// event triggers
// databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.create
// databases.650750f16cd0c482bb83.collections.65075108a4025a4f5bd7.documents.*.update

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
    let increment = req.body.seen ? -1 : 1;
    let resultTotal = userDoc.totalUnseen + increment;
    if (resultTotal < 0) resultTotal = 0;
    await db.updateDocument(
      process.env.APP_DATABASE,
      process.env.USERS_COLLECTION,
      req.body.to,
      {
        totalUnseen: resultTotal,
      }
    );
    return res.json({
      ok: true,
      $id: req.body.to,
      totalUnseen: resultTotal,
    });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
