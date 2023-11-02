import { Router } from 'express';
import { welcome } from '../controllers/home.controller';

class HomeRoutes {
  router = Router();

  constructor() {
    this.intializeRoutes();
  }

  intializeRoutes() {
    this.router.get('/', welcome);
  }
}

export default new HomeRoutes().router;
