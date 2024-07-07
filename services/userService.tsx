import { Query } from "react-native-appwrite";

import { listDocuments } from "@/services/apiService";
import { USERS_COLLECTION } from "@/constants/config";

// Sign In
export async function listUsers() {
  try {
    const users = await listDocuments(USERS_COLLECTION, [
      Query.orderAsc("$updatedAt"),
    ]);

    console.log(users);
    return users;
  } catch (error) {
    throw new Error(error);
  }
}
