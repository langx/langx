export interface createMessageRequestInterface {
  roomId: string;
  to: string;
  body: string;
  isImage: boolean;
  image?: string;
}
