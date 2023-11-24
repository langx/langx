import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface tempMessageInterface {
  body?: string;
  to: string;
  roomId: string;
  isImage: boolean;
  image?: URL;
  error: ErrorInterface | null;
}
