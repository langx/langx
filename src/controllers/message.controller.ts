import { Request, Response } from 'express';
import { throwIfMissing } from '../utils/utils';
import {
  Client,
  Databases,
  Account,
  ID,
  Permission,
  Role,
} from 'node-appwrite';
import 'dotenv/config';

const env: any = {
  APP_ENDPOINT: process.env.APP_ENDPOINT as string,
  APP_PROJECT: process.env.APP_PROJECT as string,
  API_KEY: process.env.API_KEY as string,
  APP_DATABASE: process.env.APP_DATABASE as string,
  MESSAGES_COLLECTION: process.env.MESSAGES_COLLECTION as string,
};

export default class MessageController {
  async create(req: Request, res: Response) {
    try {
      throwIfMissing(req.headers, ['x-appwrite-user-id', 'x-appwrite-jwt']);
      throwIfMissing(req.body, ['to', 'body', 'roomId']);
      const sender: string = req.headers['x-appwrite-user-id'] as string;
      const jwt: string = req.headers['x-appwrite-jwt'] as string;
      const to: string = req.body.to;
      const body: string = req.body.body;
      const roomId: string = req.body.roomId;

      // Logs
      // console.log(typeof req.headers['x-appwrite-jwt'], jwt);
      // console.log(typeof req.headers['x-appwrite-user-id'], sender);
      // console.log(typeof to, to);

      // Check JWT
      const verifyUser = new Client()
        .setEndpoint(env.APP_ENDPOINT)
        .setProject(env.APP_PROJECT)
        .setJWT(jwt);

      const account = new Account(verifyUser);
      const user = await account.get();
      // console.log(`user: ${JSON.stringify(user)}`);

      if (user.$id === sender) {
        console.log('jwt is valid');
      } else {
        console.log('jwt is invalid');
        return res.status(400).json({ ok: false, error: 'jwt is invalid' });
      }

      const client = new Client()
        .setEndpoint(env.APP_ENDPOINT)
        .setProject(env.APP_PROJECT)
        .setKey(env.API_KEY);

      const database = new Databases(client);

      // Create a message
      let messageData = { sender: sender, to: to, roomId: roomId, body: body };

      // Create document
      let message = await database.createDocument(
        env.APP_DATABASE,
        env.MESSAGES_COLLECTION,
        ID.unique(),
        messageData,
        [
          Permission.read(Role.user(to)),
          Permission.read(Role.user(sender)),
          Permission.update(Role.user(sender)),
          Permission.delete(Role.user(sender)),
        ]
      );

      message?.$id
        ? console.log('message created')
        : console.log('message not created');

      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({
        message: 'Internal Server Error!',
        err: err,
      });
    }
  }
}
