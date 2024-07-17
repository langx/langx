import { Query } from "react-native-appwrite";
import axios from "axios";

import { Message } from "@/models/Message";
import { listDocuments } from "@/services/apiService";
import {
  API_ENDPOINT,
  MESSAGES_COLLECTION,
  PAGINATION_LIMIT,
} from "@/constants/config";

export async function listMessages(params: any) {
  const roomId = params?.roomId;
  const offset = params?.currentOffset;
  try {
    const queries = [
      Query.orderDesc("$createdAt"),
      Query.equal("roomId", roomId),
      Query.limit(PAGINATION_LIMIT),
    ];

    if (offset) {
      queries.push(Query.offset(offset));
    }

    const messages = await listDocuments(MESSAGES_COLLECTION, queries);
    return messages.documents as Message[];
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function createMessage({ newMessage, currentUserId, jwt }) {
  try {
    const response = await axios.post(`${API_ENDPOINT}/message`, newMessage, {
      headers: {
        "x-appwrite-user-id": currentUserId,
        "x-appwrite-jwt": jwt.jwt,
      },
    });
    // console.log("Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}
