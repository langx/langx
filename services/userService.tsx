import { Query } from "react-native-appwrite";

import { listDocuments } from "@/services/apiService";
import { USERS_COLLECTION, PAGINATION_LIMIT } from "@/constants/config";
import { User } from "@/models/User";

export async function listUsers(
  userId: string,
  filterData?: any,
  offset?: number
): Promise<User[]> {
  // console.log("userId", userId);
  // console.log("filterData", filterData);
  try {
    const queries = [
      Query.orderDesc("$updatedAt"),
      // Query.notEqual("$id", userId),
      Query.limit(PAGINATION_LIMIT),
    ];

    if (offset) {
      queries.push(Query.offset(offset));
    }

    // Add additional filters from filterData if provided
    // if (filterData) {
    //   Object.keys(filterData).forEach((key) => {
    //     queries.push(Query.equal(key, filterData[key]));
    //   });
    // }

    const users = await listDocuments(USERS_COLLECTION, queries);
    return users.documents as User[];
  } catch (error) {
    throw new Error(error.message);
  }
}
