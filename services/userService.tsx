import { Query } from "react-native-appwrite";
import { listDocuments } from "@/services/apiService";
import { USERS_COLLECTION, PAGINATION_LIMIT } from "@/constants/config";
import { User } from "@/models/User";

export async function listUsers(offset?: number) {
  try {
    const queries = [
      Query.orderDesc("$updatedAt"),
      Query.limit(PAGINATION_LIMIT),
    ];

    if (offset) {
      queries.push(Query.offset(offset));
    }

    const users = await listDocuments(USERS_COLLECTION, queries);
    return users.documents as User[];
  } catch (error) {
    throw new Error(error);
  }
}
