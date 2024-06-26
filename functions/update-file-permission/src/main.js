import { Client, Databases, Query } from 'node-appwrite';

// Event Triggers
// "events": [
//   "buckets.655fedc46d24b615878a.files.*.create",
//   "buckets.6563aa2ef2cd2964cf27.files.*.create"
// ],

export default async ({ req, res, log, error }) => {
  // Init SDK
  const client = new Client()
    .setEndpoint(process.env.APP_ENDPOINT)
    .setProject(process.env.APP_PROJECT)
    .setKey(process.env.API_KEY);

  const db = new Databases(client);

  log('update-file-permission');

  try {
    log(req.body);
    return res.json({ ok: true });
  } catch (err) {
    log('Error occurred while searching for user: ', err.message);
    return res.json({ ok: false, error: err.message }, 400);
  }
};
