import { Client } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  log('Hello, Logs!');
  log(req);

  // `res.json()` is a handy helper for sending JSON
  return res.json({
    motto: 'Build Fast. Scale Big. All in One Place.',
    learn: 'https://appwrite.io/docs',
    connect: 'https://appwrite.io/discord',
    getInspired: 'https://builtwith.appwrite.io',
  });
};
