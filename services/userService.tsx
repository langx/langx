import { ID, Query } from "react-native-appwrite";
import axios from "axios";
import _ from "lodash";

import { User } from "@/models/User";
import { Jwt } from "@/models/Jwt";
// import { Visit } from "@/models/Visit";
// import { Report } from "@/models/Report";
import { FilterDataInterface } from "@/models/utils/FilterData.interface";
import { listDocuments, createDocument } from "@/services/apiService";
import {
  USERS_COLLECTION,
  // VISITS_COLLECTION,
  // STREAKS_COLLECTION,
  // REPORTS_COLLECTION,
  PAGINATION_LIMIT,
  API_ENDPOINT,
} from "@/constants/config";
import { CompleteRegistrationRequestInterface } from "@/models/requests/completeRegistrationRequestInterface";

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
  const filterData: FilterDataInterface =
    JSON.parse(params?.filterData) || null;
  const offset = params?.currentOffset || null;
  const searchText = params?.searchText || null;

  console.log("[FILTER] ", typeof filterData, filterData);

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

// Create User Document
export async function createUserDoc(
  data: CompleteRegistrationRequestInterface,
  jwt: Jwt,
  userId: string
): Promise<User> {
  try {
    const response = await axios.post(`${API_ENDPOINT}/user`, data, {
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

// Create Visit Document
// export async function createVisitDoc(to: string, jwt: Jwt): Promise<Visit> {
//   try {
//     const response = await axios.post(
//       `${API_ENDPOINT}/visit`,
//       { to },
//       {
//         headers: {
//           "x-appwrite-jwt": jwt.jwt,
//         },
//       }
//     );
//     return response.data;
//   } catch (error) {
//     console.error("Error creating visit:", error);
//     throw error;
//   }
// }

// List Visits
// export async function listVisits(
//   currentUserId: string,
//   offset?: number
// ): Promise<Visit[]> {
//   try {
//     const queries = [
//       Query.equal("to", currentUserId),
//       Query.orderDesc("$updatedAt"),
//       Query.limit(PAGINATION_LIMIT),
//     ];

//     if (offset) {
//       queries.push(Query.offset(offset));
//     }

//     const visits = await listDocuments(VISITS_COLLECTION, queries);
//     return visits.documents as Visit[];
//   } catch (error) {
//     console.error("Error listing visits:", error);
//     throw error;
//   }
// }

// List Streaks
// export async function listStreaks(offset?: number): Promise<any[]> {
//   try {
//     const queries = [
//       Query.isNotNull("userId"),
//       Query.orderDesc("daystreak"),
//       Query.limit(PAGINATION_LIMIT),
//     ];

//     if (offset) {
//       queries.push(Query.offset(offset));
//     }

//     const streaks = await listDocuments(STREAKS_COLLECTION, queries);
//     return streaks.documents;
//   } catch (error) {
//     console.error("Error listing streaks:", error);
//     throw error;
//   }
// }

// Block User
// export async function blockUser(
//   currentUser: User,
//   userId: string,
//   jwt: Jwt
// ): Promise<User> {
//   try {
//     const updatedUser = {
//       blockedUsers: [...currentUser.blockedUsers, userId],
//     };
//     return await updateUser(currentUser.$id, jwt, updatedUser);
//   } catch (error) {
//     console.error("Error blocking user:", error);
//     throw error;
//   }
// }

// Unblock User
// export async function unBlockUser(
//   currentUser: User,
//   userId: string,
//   jwt: Jwt
// ): Promise<User> {
//   try {
//     const updatedUser = {
//       blockedUsers: currentUser.blockedUsers.filter((id) => id !== userId),
//     };
//     return await updateUser(currentUser.$id, jwt, updatedUser);
//   } catch (error) {
//     console.error("Error unblocking user:", error);
//     throw error;
//   }
// }

// Report User
// export async function reportUser(
//   currentUserId: string,
//   userId: string,
//   reason: string,
//   jwt: Jwt
// ): Promise<Report> {
//   try {
//     const reportData = {
//       reason,
//       to: userId,
//       sender: currentUserId,
//     };
//     const response = await createDocument(
//       REPORTS_COLLECTION,
//       ID.unique(),
//       reportData
//     );
//     return response as Report;
//   } catch (error) {
//     console.error("Error reporting user:", error);
//     throw error;
//   }
// }

// Check Username
// export async function checkUsername(username: string): Promise<boolean> {
//   try {
//     const response = await listDocuments(USERS_COLLECTION, [
//       Query.equal("username", username),
//     ]);
//     return response.total === 0;
//   } catch (error) {
//     console.error("Error checking username:", error);
//     throw error;
//   }
// }

// Upload User File
// export async function uploadUserFile(request: File, jwt: Jwt): Promise<any> {
//   try {
//     const formData = new FormData();
//     formData.append("file", request);

//     const response = await axios.post(`${API_ENDPOINT}/upload`, formData, {
//       headers: {
//         "x-appwrite-jwt": jwt.jwt,
//         "Content-Type": "multipart/form-data",
//       },
//     });
//     return response.data;
//   } catch (error) {
//     console.error("Error uploading file:", error);
//     throw error;
//   }
// }

// Get User File View
// export async function getUserFileView(fileId: string, jwt: Jwt): Promise<URL> {
//   try {
//     const response = await axios.get(`${API_ENDPOINT}/file/view/${fileId}`, {
//       headers: {
//         "x-appwrite-jwt": jwt.jwt,
//       },
//     });
//     return response.data;
//   } catch (error) {
//     console.error("Error getting file view:", error);
//     throw error;
//   }
// }

// Get User File Preview
// export async function getUserFilePreview(
//   fileId: string,
//   jwt: Jwt
// ): Promise<URL> {
//   try {
//     const response = await axios.get(`${API_ENDPOINT}/file/preview/${fileId}`, {
//       headers: {
//         "x-appwrite-jwt": jwt.jwt,
//       },
//     });
//     return response.data;
//   } catch (error) {
//     console.error("Error getting file preview:", error);
//     throw error;
//   }
// }

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
  if (filterData?.motherLanguages?.length > 0) {
    const keywords = filterData.motherLanguages;
    // OR Query for users with any of the selected languages
    queries.push(Query.contains("motherLanguages", keywords));
  }
  if (filterData?.studyLanguages?.length > 0) {
    const keywords = filterData.studyLanguages;
    // OR Query for users with any of the selected languages
    queries.push(Query.contains("studyLanguages", keywords));
  }

  return queries;
}
