import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export interface tempMessageInterface {
  to: string;
  roomId: string;
  isText: boolean;
  body?: string;
  isImage: boolean;
  image?: URL;
  isAudio: boolean;
  audio?: URL;
  error: ErrorInterface | null;
}
