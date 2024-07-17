export interface createMessageRequestInterface {
  $id: string;
  to: string;
  roomId: string;
  type: string;
  replyTo?: string;
  body?: string;
  imageId?: string;
  audioId?: string;
}
