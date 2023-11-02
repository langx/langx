import { Request, Response } from 'express';
import { throwIfMissing } from '../utils/utils';
import { Client, Databases, ID, Permission, Role } from 'node-appwrite';
import 'dotenv/config';

const env: any= {
  APP_ENDPOINT: process.env.APP_ENDPOINT as string,
  APP_PROJECT: process.env.APP_PROJECT as string,
  API_KEY: process.env.API_KEY as string,
  APP_DATABASE: process.env.APP_DATABASE as string,
  ROOMS_COLLECTION: process.env.ROOMS_COLLECTION as string,
};

const client = new Client()
  .setEndpoint(env.APP_ENDPOINT)
  .setProject(env.APP_PROJECT)
  .setKey(env.API_KEY);

const database = new Databases(client);

export default class MessageController {
  async create(req: Request, res: Response) {
    try {
      throwIfMissing(req.headers, ['x-appwrite-user-id']);
      throwIfMissing(req.body, ['to']);
      const sender: string = req.headers['x-appwrite-user-id'] as string;
      const to: string = req.body.to;

      // Create a room
      let roomData = { users: [sender, to] };
      console.log(typeof req.headers['x-appwrite-user-id'], sender);
      console.log(typeof to, to);

      console.log(roomData);
      let room = await database.createDocument(
        env.APP_DATABASE,
        env.ROOMS_COLLECTION,
        ID.unique(),
        roomData,
        [Permission.read(Role.user(sender)), Permission.read(Role.user(to))]
      );

      console.log(room);

      res.status(201).json({
        message: 'create OK',
        to: req.body.to,
        sender: req.headers['user-id'],
      });
    } catch (err) {
      res.status(500).json({
        message: 'Internal Server Error!',
        err: err,
      });
    }
  }
}
