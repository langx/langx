export interface createMessageRequestInterface {
  to: string;
  roomId: string;
  isText: boolean;
  body?: string;
  isImage: boolean;
  image?: URL;
  isAudio: boolean;
  audio?: URL;
}
