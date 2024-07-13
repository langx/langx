import { Query } from "react-native-appwrite";
import { listDocuments } from "@/services/apiService";
import {
  ROOMS_COLLECTION,
  USERS_COLLECTION,
  MESSAGES_COLLECTION,
  PAGINATION_LIMIT,
} from "@/constants/config";
import { Room } from "@/models/Room";
import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";
import { sampleUser } from "@/constants/sampleUser";

export async function listRooms(params: any) {
  const userId = params?.userId;
  const filterData = params?.filterData;
  const offset = params?.currentOffset;
  // console.log("userId", userId);
  // console.log("filterData", filterData);
  console.log("offset", offset);
  try {
    const queries = [
      Query.orderDesc("lastMessageUpdatedAt"),
      Query.contains("users", userId),
      Query.limit(PAGINATION_LIMIT),
    ];

    if (offset) {
      queries.push(Query.offset(offset));
    }

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

    const extendedRooms = (await Promise.all(
      (
        await listDocuments(ROOMS_COLLECTION, queries)
      ).documents.map(async (room) => {
        const sender = room.users.find((user: string) => user !== userId);
        const userData = await fetchUserData(sender);
        const messages = await fetchMessagesData(room.$id);
        return {
          ...room,
          userData,
          messages,
        };
      })
    )) as RoomExtendedInterface[];

    return extendedRooms;
  } catch (error) {
    throw new Error(error);
  }
}
