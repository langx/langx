import {
  Account,
  Client,
  Databases,
  Storage,
  ImageGravity,
} from "react-native-appwrite";

import {
  APP_PACKAGE_NAME,
  DB_ENDPOINT,
  APP_PROJECT,
  APP_DATABASE,
  USERS_COLLECTION,
} from "@/constants/config";

const appwriteConfig = {
  endpoint: DB_ENDPOINT,
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

export { client };

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// DATABASE
export const getDocument = async (collectionId: string, documentId: string) => {
  try {
    const document = await databases.getDocument(
      appwriteConfig.databaseId,
      collectionId,
      documentId
    );

    return document;
  } catch (error) {
    throw new Error(error);
  }
};

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

export const updateDocument = async (
  collectionId: string,
  documentId: string,
  data: Object
) => {
  try {
    const updatedDocument = await databases.updateDocument(
      appwriteConfig.databaseId,
      collectionId,
      documentId,
      data
    );

    return updatedDocument;
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

// STORAGE
export async function createFile(
  bucketId: string,
  fileId: string,
  file: any
): Promise<any> {
  return storage.createFile(bucketId, fileId, file);
}

export async function getFileView(
  bucketId: string,
  fileId: string
): Promise<URL> {
  return storage.getFileView(bucketId, fileId);
}

export async function getFilePreview(
  bucketId: string,
  fileId: string
): Promise<URL> {
  return storage.getFilePreview(
    bucketId,
    fileId,
    350,
    350,
    ImageGravity.Center,
    75
  );
}

export async function getFileDownload(
  bucketId: string,
  fileId: string
): Promise<URL> {
  return storage.getFileDownload(bucketId, fileId);
}
