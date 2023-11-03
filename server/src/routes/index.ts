import { Application } from 'express';
import homeRoutes from './home.routes';
import roomRoutes from "./room.routes";

export default class Routes {
  constructor(app: Application) {
    app.use('/api', homeRoutes);
    app.use("/api/room", roomRoutes);
  }
}
