import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

// TODO: add error handling
// TODO: check req.user is session user
// TODO: check req.bodyRaw is valid JSON
// TODO: check req.bodyRaw has users array
// TODO: check req.bodyRaw has 2 users
// TODO: check req.bodyRaw has valid users
// TODO: check req.bodyRaw has users that are not the same
// TODO: check req.bodyRaw has users that are not already in a same room

// to TEST in console, execute with POST request
// {"users": ["6512ecb2917a0cdb2be2","6512ece88600be61c83b"]}
export default async ({ req, res, log, error }) => {
  if (req.method === 'GET') {
    // Send a response with the res object helpers
    // `res.send()` dispatches a string back to the client
    return res.send('Hello, World!');
  }

  // The `req` object contains the request data
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const database = new Databases(client);
  // const teams = new Teams(client);

  // TODO: check req.user is session user

  // Get body
  let body = JSON.parse(req.bodyRaw);
  log(body);
  log(body.users[0]);
  log(body.users[1]);

  // Create a common room
  let roomData = { users: body.users, typing: [false, false] };
  let room = await database.createDocument(
    process.env.APP_DATABASE,
    process.env.ROOMS_COLLECTION,
    ID.unique(),
    roomData,
    [
      Permission.read(Role.user(body.users[0])),
      Permission.read(Role.user(body.users[1])),
    ]
  );
  log(room);

  return res.json(room);
};
