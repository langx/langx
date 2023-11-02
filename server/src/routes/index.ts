import { Application } from 'express';
import homeRoutes from './home.routes';
import testRoutes from "./test.routes";

export default class Routes {
  constructor(app: Application) {
    app.use('/api', homeRoutes);
    app.use("/api/test", testRoutes);
  }
}
