import { Query } from "react-native-appwrite";

import {
  ROOMS_COLLECTION,
  USERS_COLLECTION,
  MESSAGES_COLLECTION,
  PAGINATION_LIMIT,
} from "@/constants/config";
import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";
import { Room } from "@/models/Room";
import { listDocuments } from "@/services/apiService";
import { getCurrentUser } from "@/services/authService";

export async function listRooms(params: any) {
  const userId = params?.userId;
  const roomId = params?.roomId;
  const filterData = params?.filterData;
  const offset = params?.currentOffset;
  // console.log("userId", userId);
  // console.log("filterData", filterData);
  // console.log("offset", offset);
  try {
    const queries = [
      Query.orderDesc("lastMessageUpdatedAt"),
      Query.limit(PAGINATION_LIMIT),
    ];

    if (userId) {
      queries.push(Query.contains("users", userId));
    }

    if (roomId) {
      queries.push(Query.equal("$id", roomId));
    }

    if (offset) {
      queries.push(Query.offset(offset));
    }

    const rooms = await listDocuments(ROOMS_COLLECTION, queries);
    const extendedRooms = await Promise.all(
      rooms.documents.map((room: Room) => extendRoom(room))
    );

    return extendedRooms as RoomExtendedInterface[];
  } catch (error) {
    throw new Error(error);
  }
}

export async function extendRoom(room: Room) {
  const currentUserId = (await getCurrentUser()).$id;
  const sender = room.users.find((user: string) => user !== currentUserId);

  const [userData, messages] = await Promise.all([
    fetchUserData(sender),
    fetchMessagesData(room.$id),
  ]);

  return {
    ...room,
    userData,
    messages,
  } as RoomExtendedInterface;
}

// Utils

const fetchUserData = async (senderId: string) => {
  const usersResponse = await listDocuments(USERS_COLLECTION, [
    Query.equal("$id", senderId),
    Query.limit(1),
  ]);
  return usersResponse.documents[0];
};

const fetchMessagesData = async (roomId: string) => {
  const messagesResponse = await listDocuments(MESSAGES_COLLECTION, [
    Query.equal("roomId", roomId),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  return messagesResponse.documents;
};
