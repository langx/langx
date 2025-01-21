import { API_ENDPOINT } from "@/constants/config";
import axios from "axios";

import { Jwt } from "@/models/Jwt";
import { createLanguageRequestInterface } from "@/models/requests/createLanguageRequestInterface";
import { Language } from "@/models/Language";

// Create User Document
export async function createLanguageDoc(
  data: createLanguageRequestInterface,
  jwt: Jwt,
  userId: string
): Promise<Language> {
  try {
    const response = await axios.post(`${API_ENDPOINT}/language`, data, {
      headers: {
        "x-appwrite-jwt": jwt.jwt,
        "x-appwrite-user-id": userId,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}
