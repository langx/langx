import { getFilePreview } from "@/services/apiService";
import { USER_BUCKET } from "@/constants/config";

export async function getUserImage(imageId: string) {
  return getFilePreview(USER_BUCKET, imageId);
}
