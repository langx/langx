import { Client, Databases, Account } from 'node-appwrite';

// execute = ["users"]

const roles = {
  moderator: '1211342347552563251',
  'early-adopter': '1212395552193515551',
  sponsor: '1222464830028386394',
  creator: '1232679338969792573',
  fundamental: '1223726462494838805',
  pioneer: '1220823209381728348',
};

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setJWT(req.headers['x-appwrite-user-jwt'] || '');

  const account = new Account(client);
  const db = new Databases(client);

  const userDoc = await db.getDocument(
    process.env.APP_DATABASE,
    process.env.USERS_COLLECTION,
    req.headers['x-appwrite-user-id']
  );

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

      const guildId = process.env.DISCORD_GUILD_ID;
      log(`Guild ID: ${guildId}`);
      const discordBotToken = process.env.DISCORD_LANGX_BADGES;
      log(`Bot token: ${discordBotToken}`);

      // Fetch user roles from Discord
      const response = await fetch(
        `https://discord.com/api/v9/guilds/${guildId}/members/${discordIdentity.providerUid}`,
        {
          headers: {
            Authorization: `Bot ${discordBotToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user roles: ${response.statusText}`);
      }

      const memberData = await response.json();
      log(memberData);
      const userRoles = memberData['roles'];

      log(`User roleIds: ${userRoles}`);

      const userRolesNames = userRoles
        .map((roleId) => {
          const roleName = Object.keys(roles).find(
            (name) => roles[name] === roleId
          );
          return roleName;
        })
        .filter(Boolean);

      log(`User roles: ${userRolesNames.join(', ')}`);
      log(`User badges ${userDoc.badges.join(', ')}`);

      return res.json({ newBadges: [] });
    } else {
      throw new Error('Discord identity not found');
    }
  } catch (err) {
    error(err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
