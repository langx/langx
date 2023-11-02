import { Router } from 'express';
import TestController from '../controllers/test.controller';

class TutorialRoutes {
  router = Router();
  controller = new TestController();

  constructor() {
    this.intializeRoutes();
  }

  intializeRoutes() {
    // Create a new Tutorial
    this.router.post('/', this.controller.create);
  }
}

export default new TutorialRoutes().router;
