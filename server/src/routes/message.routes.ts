import { Router } from 'express';
import MessageController from '../controllers/message.controller';

class MessageRoutes {
  router = Router();
  controller = new MessageController();

  constructor() {
    this.intializeRoutes();
  }

  intializeRoutes() {
    // Create a new Tutorial
    this.router.post('/', this.controller.create);
  }
}

export default new MessageRoutes().router;
