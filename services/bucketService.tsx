import { getFilePreview } from "@/services/apiService";
import { USER_BUCKET, MESSAGE_BUCKET } from "@/constants/config";

export async function getUserImage(imageId: string) {
  return getFilePreview(USER_BUCKET, imageId);
}

export async function getMessageImage(imageId: string) {
  return getFilePreview(MESSAGE_BUCKET, imageId);
}
