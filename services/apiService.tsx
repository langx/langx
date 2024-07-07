import { Account, Client, Databases } from "react-native-appwrite";

import {
  APP_PACKAGE_NAME,
  APP_ENDPOINT,
  APP_PROJECT,
  APP_DATABASE,
  USERS_COLLECTION,
} from "@/constants/config";

const appwriteConfig = {
  endpoint: APP_ENDPOINT,
  platform: APP_PACKAGE_NAME,
  projectId: APP_PROJECT,
  databaseId: APP_DATABASE,
  usersCollection: USERS_COLLECTION,
};
const client = new Client();

client
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)
  .setPlatform(appwriteConfig.platform);

export const account = new Account(client);
export const databases = new Databases(client);

export const createDocument = async (
  collectionId: string,
  documentId: string,
  data: Object
) => {
  try {
    const newDocument = await databases.createDocument(
      appwriteConfig.databaseId,
      collectionId,
      documentId,
      data
    );

    return newDocument;
  } catch (error) {
    throw new Error(error);
  }
};

export const listDocuments = async (
  collectionId: string,
  queries?: string[]
) => {
  try {
    const documents = await databases.listDocuments(
      appwriteConfig.databaseId,
      collectionId,
      queries || []
    );

    return documents;
  } catch (error) {
    throw new Error(error);
  }
};
