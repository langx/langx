import {
  Client,
  Databases,
  Account,
  ID,
  Permission,
  Role,
} from 'node-appwrite';

// to TEST in console, execute with POST request
// {"users": ["6512ecb2917a0cdb2be2","6512ece88600be61c83b"]}
export default async ({ req, res, log, error }) => {
  // Log request
  log('req:');
  log(req);

  let isLogged = false;
  let response = {};

  if (!req.headers['x-appwrite-user-id']) {
    error('user_id_missing');
    return res.json({
      code: 400,
      type: 'user_id_missing',
    });
  }

  if (!req.headers['x-appwrite-user-jwt']) {
    error('user_jwt_missing');
    return res.json({
      code: 400,
      type: 'user_jwt_missing',
    });
  }

  if (!req.bodyRaw) {
    error('body_missing');
    return res.json({
      code: 400,
      type: 'body_missing',
    });
  }

  // START: VERIFY USER WITH JWT
  const verifyUser = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setJWT(req.headers['x-appwrite-user-jwt']);

  const account = new Account(verifyUser);
  await account.get().then(
    (result) => {
      if (result.$id === req.headers['x-appwrite-user-id']) {
        isLogged = true;
        log('jwt is valid');
      }
      response = result;
    },
    (error) => {
      log('jwt is invalid');
      log(error);
      response = error;
      // {"code":401,"type":"user_jwt_invalid","response":{"message":"Failed to verify JWT. Invalid token: Incomplete segments","code":401,"type":"user_jwt_invalid","version":"1.4.5"}}
    }
  );

  if (!isLogged) {
    return res.json(response);
  }
  // END: VERIFY USER WITH JWT

  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const database = new Databases(client);

  // Get body
  let body = JSON.parse(req.bodyRaw);
  log('body:');
  log(body);

  // Create a room
  let roomData = { users: [req.headers['x-appwrite-user-id'], body.to] };
  let room = await database.createDocument(
    process.env.APP_DATABASE,
    process.env.ROOMS_COLLECTION,
    ID.unique(),
    roomData,
    [
      Permission.read(Role.user(req.headers['x-appwrite-user-id'])),
      Permission.read(Role.user(body.to)),
    ]
  );
  log(room);

  return res.json(room);
};
