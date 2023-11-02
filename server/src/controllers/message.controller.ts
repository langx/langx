import { Request, Response } from 'express';
import { throwIfMissing } from '../utils/utils';

export default class MessageController {
  async create(req: Request, res: Response) {
    try {
      throwIfMissing(req.headers, ['user-agent']);
      throwIfMissing(req.body, ['to']);

      res.status(201).json({
        message: 'create OK',
        reqBody: req.body,
      });
    } catch (err) {
      res.status(500).json({
        message: 'Internal Server Error!',
      });
    }
  }
}
