import express, { Application } from 'express';
import cors, { CorsOptions } from 'cors';
import Routes from "./routes";

export default class Server {
  constructor(app: Application) {
    this.config(app);;
    new Routes(app);
  }

  private config(app: Application): void {
    // TODO: !IMPORTANT! Change this to your Angular app URL
    // const corsOptions: CorsOptions = {
    //   origin: 'http://localhost:8100',
    // };
    // app.use(cors(corsOptions));

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
  }
}
