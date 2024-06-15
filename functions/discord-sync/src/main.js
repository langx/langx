import { Client, Databases, Account } from 'node-appwrite';

// execute = ["users"]

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setJWT(req.headers['x-appwrite-user-jwt'] || '');

  const account = new Account(client);
  // const db = new Databases(client);

  // const userDoc = await db.getDocument(
  //   process.env.APP_DATABASE,
  //   process.env.USERS_COLLECTION,
  //   req.body.to
  // );

  // const admin = new Client()
  //   .setEndpoint(process.env.APP_ENDPOINT)
  //   .setProject(process.env.APP_PROJECT)
  //   .setKey(process.env.APP_KEY);

  try {
    const identities = await account.listIdentities();
    const discordIdentity = identities.identities.find(
      (identity) => identity.provider === 'discord'
    );

    if (discordIdentity) {
      log('Discord identity found');
      log(discordIdentity);
    }

    return res.json({ newBadges: [] });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
