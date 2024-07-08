import { Query } from "react-native-appwrite";

import { listDocuments } from "@/services/apiService";
import { USERS_COLLECTION } from "@/constants/config";
import { User } from "@/models/User";

export async function listUsers() {
  try {
    const users = await listDocuments(USERS_COLLECTION, [
      Query.orderDesc("$updatedAt"),
    ]);
    return users.documents as User[];
  } catch (error) {
    throw new Error(error);
  }
}
