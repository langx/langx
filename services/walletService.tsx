import { Query } from "react-native-appwrite";

import { Wallet } from "@/models/Wallet";
import { listDocuments } from "@/services/apiService";
import { WALLET_COLLECTION } from "@/constants/config";

// Fetch a specific user's wallet
export async function getWallet(userId: string) {
  try {
    const queries = [Query.equal("$id", userId)];

    const response = await listDocuments(WALLET_COLLECTION, queries);
    return response.documents as Wallet[];
  } catch (error) {
    throw new Error(error);
  }
}

// Fetch the list of all wallets
// export async function listWallets(): Promise<listWalletsResponseInterface> {
//   try {
//     const response = await axios.get(`${API_LEADERBOARD}/token`);
//     return response.data as listWalletsResponseInterface;
//   } catch (error) {
//     throw new Error(error);
//   }
// }
