import { Client, Databases, Account } from 'node-appwrite';

// execute = ["users"]

const roles = {
  'early-adopter': '1212395552193515551',
  backer: '1222464830028386394',
  creator: '1232679338969792573',
  fundamental: '1223726462494838805',
  pioneer: '1220823209381728348',
};

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setJWT(req.headers['x-appwrite-user-jwt'] || '');

  const account = new Account(client);
  const db = new Databases(client);

  const admin = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const adminDB = new Databases(admin);

  try {
    const userDoc = await db.getDocument(
      process.env.APP_DATABASE,
      process.env.USERS_COLLECTION,
      req.headers['x-appwrite-user-id']
    );

    const identities = await account.listIdentities();
    const discordIdentity = identities.identities.find(
      (identity) => identity.provider === 'discord'
    );

    if (!discordIdentity) {
      throw new Error('Discord identity not found');
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    const discordBotToken = process.env.DISCORD_LANGX_BADGES;

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
    const userRoles = memberData.roles;

    const userRolesNames = userRoles
      .map((roleId) => {
        const roleName = Object.keys(roles).find(
          (name) => roles[name] === roleId
        );
        return roleName;
      })
      .filter(Boolean);

    const userBadges = userDoc.badges || [];
    const filteredBadges = userBadges.filter((badge) =>
      Object.keys(roles).includes(badge)
    );

    const newRoles = filteredBadges.filter(
      (role) => !userRolesNames.includes(role)
    );
    const newBadges = userRolesNames.filter(
      (badge) => !filteredBadges.includes(badge)
    );

    log(`userRoles: ${userRolesNames}`);
    log(`userBadges: ${filteredBadges}`);
    log(`newRoles: ${newRoles}`);
    log(`newBadges: ${newBadges}`);
    if (newRoles.length > 0) {
      const roleIds = newRoles.map((badge) => roles[badge]);

      const rolePromises = roleIds.map((roleId) =>
        fetch(
          `https://discord.com/api/v9/guilds/${guildId}/members/${discordIdentity.providerUid}/roles/${roleId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${discordBotToken}`,
            },
          }
        ).then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to add role ${roleId}: ${response.statusText}`
            );
          }
        })
      );

      await Promise.all(rolePromises);
    }

    if (newBadges.length > 0) {
      await adminDB.updateDocument(
        process.env.APP_DATABASE,
        process.env.USERS_COLLECTION,
        req.headers['x-appwrite-user-id'],
        {
          badges: [...userBadges, ...newBadges],
        }
      );
    }

    return res.json({ newBadges, newRoles });
  } catch (err) {
    error(err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
