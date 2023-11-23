import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface tempMessageInterface {
  roomId: string;
  to: string;
  body: string;
  isImage: boolean;
  error: ErrorInterface | null;
}
