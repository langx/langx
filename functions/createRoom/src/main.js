import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

// This is your Appwrite function
// It's executed each time we get a request
const environment = {
  APP_ENDPOINT: 'https://db.languagexchange.net/v1',
  APP_PROJECT: '650750d21e4a6a589be3',
  APP_DATABASE: '650750f16cd0c482bb83',
  ROOMS_COLLECTION: '6507510fc71f989d5d1c',
  API_KEY:
    'e052b7a37cc5620a607b6c2ab701eb9c4456b029d1ff5c4346895877cb3a3a408a7e1fb02360c7091d20d73bfbe7fa4e607e155b37f4ba1ea982842618ad99e78e46cdef7bb7f0349ebf3a2ccca4d49dac9f3756283fd83e04aa46d1719a859f2c5dec2ab42efde53fa3c08ce207ecf9888b1005ba88ce5434cac3810ff1bacf',
};

// to TEST, execute with POST request
// {"users": ["6512ecb2917a0cdb2be2","6512ece88600be61c83b"]}
export default async ({ req, res, log, error }) => {
  if (req.method === 'GET') {
    // Send a response with the res object helpers
    // `res.send()` dispatches a string back to the client
    return res.send('Hello, World!');
  }

  // The `req` object contains the request data
  const client = new Client()
    .setEndpoint(environment.APP_ENDPOINT)
    .setProject(environment.APP_PROJECT)
    .setKey(environment.API_KEY);

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
    environment.APP_DATABASE,
    environment.ROOMS_COLLECTION,
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
