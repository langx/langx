export interface createMessageRequestInterface {
  to: string;
  roomId: string;
  type: string;
  body?: string;
  image?: URL;
  audio?: URL;
}
