import { Query } from "react-native-appwrite";
import { listDocuments } from "@/services/apiService";
import { ROOMS_COLLECTION, PAGINATION_LIMIT } from "@/constants/config";
import { Room } from "@/models/Room";

export async function listRooms(offset?: number) {
  try {
    const queries = [
      Query.orderDesc("lastMessageUpdatedAt"),
      Query.limit(PAGINATION_LIMIT),
    ];

    // Query for rooms that contain the current user
    // queries.push(Query.contains("users", currentUser.$id));

    if (offset) {
      queries.push(Query.offset(offset));
    }

    const rooms = await listDocuments(ROOMS_COLLECTION, queries);

    return rooms.documents as Room[];
  } catch (error) {
    throw new Error(error);
  }
}
