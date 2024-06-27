import { Client, Storage, Permission, Role } from 'node-appwrite';

import { throwIfMissing } from './utils.js';

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

  const storage = new Storage(client);

  // const result = await storage.updateFile(
  //     '<BUCKET_ID>', // bucketId
  //     '<FILE_ID>', // fileId
  //     '<NAME>', // name (optional)
  //     ["read("any")"] // permissions (optional)
  // );

  log('update-file-permission');

  try {
    log(req.body);
    const requestBody = JSON.parse(req.body);
    throwIfMissing(requestBody, ['to', 'fileId', 'type']);

    const senderId = req.headers['x-appwrite-user-id'];

    if (requestBody.type !== 'image' && requestBody.type !== 'audio') {
      return res.json({ ok: false, error: 'type is not valid' }, 400);
    } else if (requestBody.type === 'image') {
      log('type: image');
      // log(process.env.MESSAGE_BUCKET);
      // log(requestBody.fileId);
      // log(senderId);
      // log(requestBody.to);
      const updatedFileImage = await storage.updateFile(
        process.env.MESSAGE_BUCKET,
        requestBody.fileId,
        undefined,
        [
          Permission.read(Role.user(requestBody.to)),
          Permission.read(Role.user(senderId)),
        ]
      );
      log(updatedFileImage.$id);
    } else if (requestBody.type === 'audio') {
      log('type: audio');
      const updatedFileAudio = await storage.updateFile(
        process.env.AUDIO_BUCKET,
        requestBody.fileId,
        undefined,
        [
          Permission.read(Role.user(requestBody.to)),
          Permission.read(Role.user(senderId)),
        ]
      );
      log(updatedFileAudio.$id);
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }
};
