import { Client, Databases, Account, ID, Permission, Role } from 'node-appwrite';

// TODO: add error handling
// TODO: check req.user is session user
// TODO: check req.bodyRaw is valid JSON
// TODO: check req.bodyRaw has users array
// TODO: check req.bodyRaw has 2 users
// TODO: check req.bodyRaw has valid users
// TODO: check req.bodyRaw has users that are not the same
// TODO: check req.bodyRaw has users that are not already in a same room

// to TEST in console, execute with POST request
// {"users": ["6524afa03cd93836a360","65247085558316be817c"], "sender":"65247085558316be817c", "roomId":"65255ccfa80ead294d12", "body":"test string"}
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
  const account = new Account(client);

  // TODO: check req.user is session user
  log(req);
  log(req.headers);
  log(req.headers['x-appwrite-user-id']);
  log(req.headers['x-appwrite-user-jwt']);

  // Get body
  let body = JSON.parse(req.bodyRaw);
  log(body);

  // Create a common room
  let messageData = { sender: body.sender, roomId: body.roomId, body: body.body };
  let message = await database.createDocument(
    process.env.APP_DATABASE,
    process.env.MESSAGES_COLLECTION,
    ID.unique(),
    messageData,
    [
      Permission.read(Role.user(body.to)),
      Permission.read(Role.user(body.sender)),
      Permission.update(Role.user(body.sender)),
      Permission.delete(Role.user(body.sender)),
    ]
  );
  log(message);

  return res.json(message);
};
