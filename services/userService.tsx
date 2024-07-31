import { Query } from "react-native-appwrite";
import axios from "axios";
import _ from "lodash";

import { User } from "@/models/User";
import { Jwt } from "@/models/Jwt";
import { listDocuments } from "@/services/apiService";
import {
  USERS_COLLECTION,
  PAGINATION_LIMIT,
  API_ENDPOINT,
} from "@/constants/config";

interface FilterDataInterface {
  gender?: string;
  country?: string;
  ageRange?: number[];
  motherLanguages?: string[];
  studyLanguages?: string[];
  isMatchMyGender?: boolean;
}

// Update Current User
export async function updateUser(
  userId: string,
  jwt: Jwt,
  data: any
): Promise<User> {
  try {
    const response = await axios.put(`${API_ENDPOINT}/user/${userId}`, data, {
      headers: {
        "x-appwrite-user-id": userId,
        "x-appwrite-jwt": jwt.jwt,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

export async function listUsers(params: any): Promise<User[]> {
  const userId = params?.userId;
  const filterData = params?.filterData || null;
  const offset = params?.currentOffset || null;
  const searchText = params?.searchText || null;
  console.log("[FILTER] ", filterData);

  try {
    // Default queries
    const queries = [
      Query.orderDesc("lastSeen"),
      Query.notEqual("$id", userId),
      Query.limit(PAGINATION_LIMIT),
    ];

    // Offset Query
    if (offset) {
      queries.push(Query.offset(offset));
    }

    // Search Query
    if (searchText && searchText.length > 0) {
      queries.push(
        Query.or([
          Query.search("name", `"${searchText}"`),
          Query.search("aboutMe", `"${searchText}"`),
          Query.search("username", `"${searchText}"`),
        ])
      );
    }

    // Filter Queries
    if (filterData) {
      const filterQueries = createFilterQueries(filterData);
      queries.push(...filterQueries);
    }

    const users = await listDocuments(USERS_COLLECTION, queries);
    return users.documents as User[];
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get User By Username
export async function getUserByUsername(username: string): Promise<User> {
  try {
    const response = await listDocuments(USERS_COLLECTION, [
      Query.equal("username", username),
    ]);
    if (response.total === 0) {
      return null;
    }
    return response.documents[0] as User;
  } catch (error) {
    console.error("Error getting user:", error);
    throw error;
  }
}

// Utils

function createFilterQueries(filterData: FilterDataInterface): any[] {
  const queries: any[] = [];

  // Query for users with the selected gender filter
  if (filterData?.gender) {
    queries.push(Query.equal("gender", filterData?.gender));
  }

  // Query for users with the selected country filter
  if (filterData?.country) {
    queries.push(Query.equal("countryCode", filterData?.country));
  }

  // Query for users with birthdates between the selected min and max ages
  if (
    filterData?.ageRange &&
    _.isArray(filterData.ageRange) &&
    !_.isEqual(filterData.ageRange, [13, 100])
  ) {
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - filterData?.ageRange[1]);
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - filterData?.ageRange[0]);

    queries.push(Query.greaterThanEqual("birthdate", minDate.toISOString()));
    queries.push(Query.lessThanEqual("birthdate", maxDate.toISOString()));
  }

  // Query for users with the selected languages filter
  if (filterData?.motherLanguages.length > 0) {
    const keywords = filterData.motherLanguages;
    // OR Query for users with any of the selected languages
    queries.push(Query.contains("motherLanguages", keywords));
  }
  if (filterData?.studyLanguages.length > 0) {
    const keywords = filterData.studyLanguages;
    // OR Query for users with any of the selected languages
    queries.push(Query.contains("studyLanguages", keywords));
  }

  return queries;
}
