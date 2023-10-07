import { Client, Databases, Teams, Users } from 'node-appwrite';

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }) => {
  // Why not try the Appwrite SDK?
  //

  const client = new Client()
    .setEndpoint('https://db.languagexchange.net/v1')
    .setProject('650750d21e4a6a589be3')
    .setKey(
      'e052b7a37cc5620a607b6c2ab701eb9c4456b029d1ff5c4346895877cb3a3a408a7e1fb02360c7091d20d73bfbe7fa4e607e155b37f4ba1ea982842618ad99e78e46cdef7bb7f0349ebf3a2ccca4d49dac9f3756283fd83e04aa46d1719a859f2c5dec2ab42efde53fa3c08ce207ecf9888b1005ba88ce5434cac3810ff1bacf'
    );

  const databases = new Databases(client);
  const teams = new Teams(client);
  const users = new Users(client);

  log(req.bodyRaw);

  await teams
    .create('teachers', 'Teachers', ['maths', 'sciences', 'arts', 'literature'])
    .then((response) => {
      log(response); // Success

      // Invalid `email` param: Value must be a valid email address
      const promise = teams.createMembership(
        'teachers',
        ['maths'],
        'ahmet@gmail.com',
        '6512ecb2917a0cdb2be2',
        undefined,
        'localhost'
      );

      promise.then(
        function (response) {
          log(response); // Success
        },
        function (error) {
          log(error); // Failure
        }
      );
    })
    .catch((e) => {
      error(e); // Failure
    });

  const p = await teams.list();
  log(p);
  // The `req` object contains the request data
  if (req.method === 'GET') {
    // Send a response with the res object helpers
    // `res.send()` dispatches a string back to the client
    return res.send('Hello, World!');
  }

  // `res.json()` is a handy helper for sending JSON
  return res.json({
    motto: 'Build Fast. Scale Big. All in One Place.',
    learn: 'https://appwrite.io/docs',
    connect: 'https://appwrite.io/discord',
    getInspired: 'https://builtwith.appwrite.io',
  });
};
