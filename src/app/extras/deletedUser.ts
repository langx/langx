import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';

export const deletedUser: User = {
  $id: 'deleted-user',
  name: 'User Not Found',
  country: null,
  countyCode: null,
  gender: null,
  birthdate: null,
  $createdAt: null,
  $updatedAt: null,
  $databaseId: null,
  $collectionId: null,
  $permissions: null,
  sponsor: false,
  streaks: null,
  profilePic: `${environment.defaultAssets.DELETED_PP_ID}`,
  otherPics: null,
};
