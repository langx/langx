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

  const admin = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const adminDB = new Databases(admin);

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

      const userBadges = userDoc.badges || [];
      const filteredBadges = userBadges.filter((badge) =>
        Object.keys(roles).includes(badge)
      );

      log(`User roles: ${userRolesNames.join(', ')}`);
      log(`User badges ${userBadges.join(', ')}`);

      // Calculate the additions
      const newRoles = filteredBadges.filter(
        (role) => !userRolesNames.includes(role)
      );
      const newBadges = userRolesNames.filter(
        (badge) => !filteredBadges.includes(badge)
      );

      // Add new roles to the user in Discord
      if (newRoles.length > 0) {
        log(`Adding roles: ${newRoles.join(', ')}`);

        const roleIds = newRoles.map((badge) => roles[badge]);
        log(`Role Id's: ${roleIds.join(', ')}`);

        const rolePromises = roleIds.map(async (roleId) => {
          try {
            const response = await fetch(
              `https://discord.com/api/v9/guilds/${guildId}/members/${discordIdentity.providerUid}/roles/${roleId}`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bot ${discordBotToken}`,
                },
              }
            );

            if (!response.ok) {
              console.error(
                `Failed to add role ${roleId}: ${response.statusText}`
              );
            }
          } catch (error) {
            console.error(`Error adding role ${roleId}: ${error.message}`);
          }
        });

        await Promise.all(rolePromises);
        const results = await Promise.all(rolePromises);

        const errors = results.filter((result) => result instanceof Error);
        if (errors.length > 0) {
          error(err.message);
          return res.json({ ok: false, error: err.message }, 400);
        }
      }

      // Add new badges to the user
      if (newBadges.length > 0) {
        log(`Adding badges: ${newBadges.join(', ')}`);
        newBadges.forEach((badge) => {
          userBadges.push(badge);
        });
        log(`Updated badges: ${userBadges.join(', ')}`);
        await adminDB.updateDocument(
          process.env.APP_DATABASE,
          process.env.USERS_COLLECTION,
          req.headers['x-appwrite-user-id'],
          {
            badges: userBadges,
          }
        );
      }

      return res.json({ newBadges, newRoles });
    } else {
      throw new Error('Discord identity not found');
    }
  } catch (err) {
    error(err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
