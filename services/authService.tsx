import { ID, OAuthProvider, Query } from "react-native-appwrite";
import { account, createDocument, listDocuments } from "@/services/apiService";
import { USERS_COLLECTION } from "@/constants/config";
import { User } from "@/models/User";

// Register user
export async function createUser(email, password, username) {
  try {
    const newAccount = await account.create(
      ID.unique(),
      email,
      password,
      username
    );

    if (!newAccount) throw Error;

    await login(email, password);

    const newUser = await createDocument(USERS_COLLECTION, newAccount.$id, {
      email: email,
      username: username,
    });

    return newUser;
  } catch (error) {
    throw new Error(error);
  }
}

// Sign In
export async function login(email: string, password: string) {
  try {
    const session = await account.createEmailPasswordSession(email, password);

    return session;
  } catch (error) {
    throw new Error(error);
  }
}

export function createOAuth2Token(provider: OAuthProvider) {
  try {
    const SUCCESS_OAUTH2 = `langx://(auth)/success?provider=${provider}`;
    const FAILURE_OAUTH2 = `langx://(auth)/failure?provider=${provider}`;
    const token = account.createOAuth2Token(
      provider,
      SUCCESS_OAUTH2,
      FAILURE_OAUTH2
    );

    return token;
  } catch (error) {
    throw new Error(error);
  }
}

export async function createSession(userId: string, secret: string) {
  try {
    const session = await account.createSession(userId, secret);

    return session;
  } catch (error) {
    throw new Error(error);
  }
}

// Sign In as Guest
export async function createAnonymousSession() {
  try {
    const session = await account.createAnonymousSession();

    return session;
  } catch (error) {
    throw new Error(error);
  }
}

// Get Account
export async function getAccount() {
  try {
    const currentAccount = await account.get();

    return currentAccount;
  } catch (error) {
    throw new Error(error);
  }
}

// Create JWT Session
export async function createJWT() {
  try {
    const jwt = await account.createJWT();

    return jwt;
  } catch (error) {
    throw new Error(error);
  }
}

// Get Current Session
export async function getCurrentSession() {
  try {
    const currentSession = await account.getSession("current");

    return currentSession;
  } catch (error) {
    throw new Error(error);
  }
}

// Get Current User
export async function getCurrentUser() {
  try {
    const currentAccount = await getAccount();
    if (!currentAccount) throw Error;

    const currentUser = await listDocuments(USERS_COLLECTION, [
      Query.equal("$id", currentAccount.$id),
    ]);

    if (!currentUser) throw Error;

    return currentUser.documents[0] as User;
  } catch (error) {
    return null;
  }
}

// Sign Out
export async function logout() {
  try {
    const session = await account.deleteSession("current");

    return session;
  } catch (error) {
    throw new Error(error);
  }
}
