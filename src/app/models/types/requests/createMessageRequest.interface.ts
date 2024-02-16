export interface createMessageRequestInterface {
  $id: string;
  to: string;
  roomId: string;
  type: string;
  reply?: string;
  body?: string;
  image?: URL;
  audio?: URL;
}
