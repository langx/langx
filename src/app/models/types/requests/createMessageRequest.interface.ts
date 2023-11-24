export interface createMessageRequestInterface {
  body?: string;
  to: string;
  roomId: string;
  isImage: boolean;
  image?: URL;
}
