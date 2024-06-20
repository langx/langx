export interface updateRoomRequestInterface {
  roomId: string;
  data: {
    copilot?: boolean;
    archived?: boolean;
  };
}
