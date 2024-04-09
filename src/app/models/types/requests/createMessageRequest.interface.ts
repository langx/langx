export interface createMessageRequestInterface {
  $id: string;
  to: string;
  roomId: string;
  replyTo?: string;
  type: string;
  body?: string;
  imageId?: string;
  audioId?: string;
}
