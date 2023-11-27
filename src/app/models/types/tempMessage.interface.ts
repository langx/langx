import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface tempMessageInterface {
  $id: string;
  to: string;
  roomId: string;
  type: string;
  body?: string;
  image?: URL;
  audio?: URL;
  error: ErrorInterface | null;
}
