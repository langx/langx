import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface tempMessageInterface {
  $id: string;
  to: string;
  roomId: string;
  replyTo?: string;
  type: string;
  body?: string;
  imageId?: string;
  audioId?: string;
  error: ErrorInterface | null;
}
