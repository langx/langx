import { Client, Databases, Teams, Users, ID } from 'node-appwrite';

// This is your Appwrite function
// It's executed each time we get a request

// to TEST, execute with POST request
// body raw = {"teamId": "6523f37acbd9c82b2c06", "userId":"6512ee4f03b70ce08f5c"}
// curl -X POST -H "Content-Type: application/json" -d "{"teamId": "6523f37acbd9c82b2c06", "userId":"6512ee4f03b70ce08f5c"}" http://localhost:8080
export default async ({ req, res, log, error }) => {
  if (req.method === 'GET') {
    // Send a response with the res object helpers
    // `res.send()` dispatches a string back to the client
    return res.send('Hello, World!');
  }
  
  // TODO: check if user is owner of team
  // TODO: check req.user is session user

  let body = JSON.parse(req.bodyRaw);
  log('teamId:');
  log(body.teamId);
  log('userId:');
  log(body.userId);
  // The `req` object contains the request data
  const client = new Client()
    .setEndpoint('https://db.languagexchange.net/v1')
    .setProject('650750d21e4a6a589be3')
    .setKey(
      'e052b7a37cc5620a607b6c2ab701eb9c4456b029d1ff5c4346895877cb3a3a408a7e1fb02360c7091d20d73bfbe7fa4e607e155b37f4ba1ea982842618ad99e78e46cdef7bb7f0349ebf3a2ccca4d49dac9f3756283fd83e04aa46d1719a859f2c5dec2ab42efde53fa3c08ce207ecf9888b1005ba88ce5434cac3810ff1bacf'
    );

  const databases = new Databases(client);
  const teams = new Teams(client);
  const users = new Users(client);

  const bodyData = await req.bodyRaw;

  await createMembership(body.teamId, body.userId);

  const a = await teams.list();
  log('teams.list');
  log(a);

  async function createMembership(teamId, userId) {
    let id = ID.unique();
    await teams.createMembership(teamId, ['owner'], undefined, userId);
  }

  return res.json({
    motto: 'Build Fast. Scale Big. All in One Place.',
    learn: 'https://appwrite.io/docs',
    connect: 'https://appwrite.io/discord',
    getInspired: 'https://builtwith.appwrite.io',
  });
};
