import { Query } from "react-native-appwrite";
import { listDocuments } from "@/services/apiService";
import {
  ROOMS_COLLECTION,
  USERS_COLLECTION,
  PAGINATION_LIMIT,
} from "@/constants/config";
import { Room } from "@/models/Room";
import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";
import { sampleUser } from "@/constants/sampleUser";

export async function listRooms(
  userId: string,
  filterData?: any,
  offset?: number
) {
  // console.log("userId", userId);
  // console.log("filterData", filterData);
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

    const extendedRooms = (await Promise.all(
      (
        await listDocuments(ROOMS_COLLECTION, queries)
      ).documents.map(async (room) => {
        const sender = room.users.find((user: string) => user !== userId);
        const userData = await fetchUserData(sender);
        return {
          ...room,
          userData,
          messages: [],
        };
      })
    )) as RoomExtendedInterface[];

    return extendedRooms;
  } catch (error) {
    throw new Error(error);
  }
}
