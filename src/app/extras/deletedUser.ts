import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';

export const deletedUser: User = {
  $id: 'deleted-user',
  name: 'User Not Found',
  profilePhoto: new URL(
    `${environment.url.HOMEPAGE_URL}assets/image/default/user-not-found.png`
  ),
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
};
