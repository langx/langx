import { Request, Response } from 'express';

export default class TutorialController {
  async create(req: Request, res: Response) {
    try {
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
