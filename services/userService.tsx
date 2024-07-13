import { Query } from "react-native-appwrite";

import { listDocuments } from "@/services/apiService";
import { USERS_COLLECTION, PAGINATION_LIMIT } from "@/constants/config";
import { User } from "@/models/User";

export async function listUsers(params: any): Promise<User[]> {
  const userId = params?.userId;
  const filterData = params?.filterData || null;
  const offset = params?.currentOffset || null;
  console.log("userId", userId);
  console.log("filterData", filterData);
  console.log("offset", offset);
  try {
    const queries = [
      Query.orderDesc("$updatedAt"),
      Query.notEqual("$id", userId),
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
