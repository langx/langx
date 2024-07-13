import { Query } from "react-native-appwrite";
import { listDocuments } from "@/services/apiService";
import { ROOMS_COLLECTION, PAGINATION_LIMIT } from "@/constants/config";
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

    // const rooms = await listDocuments(ROOMS_COLLECTION, queries);
    // return rooms.documents as Room[];

    const extendedRooms = (
      await listDocuments(ROOMS_COLLECTION, queries)
    ).documents.map((room) => {
      return {
        ...room,
        userData: sampleUser,
        messages: [],
      };
    }) as RoomExtendedInterface[];
    return extendedRooms;
  } catch (error) {
    throw new Error(error);
  }
}
