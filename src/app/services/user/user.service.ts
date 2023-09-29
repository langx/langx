import { Injectable } from '@angular/core';
import { FilterData } from '../filter/filter.service';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { ID, Query } from 'appwrite';
import { Auth2Service } from '../auth/auth2.service';
import { Storage2Service } from '../storage/storage2.service';
@Injectable({
  providedIn: 'root',
})
export class UserService {
  NUMBER_OF_USERS_PER_PAGE = 10;

  lastVisible: any;

  constructor(
    private appwrite: AppwriteService,
    private auth2Service: Auth2Service,
    private storage: Storage2Service
  ) {}

  getUserDoc(uid: string): Promise<any> {
    return this.appwrite.getDocument(
      environment.appwrite.USERS_COLLECTION,
      uid
    );
  }

  createUserDoc(uid: string, data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.USERS_COLLECTION,
      uid,
      data
    );
  }

  updateUserDoc(uid: string, data: any): Promise<any> {
    return this.appwrite.updateDocument(
      environment.appwrite.USERS_COLLECTION,
      uid,
      data
    );
  }

  // TODO: Pagination
  listUsers(filterData?: FilterData): Promise<any> {
    const queries: any[] = [];

    // Query for users that are not the current user
    queries.push(Query.notEqual('$id', this.auth2Service.getUserId()));

    // Query for users descending by last seen
    // TODO: Update this filter for this after presence is implemented
    queries.push(Query.orderDesc('$updatedAt'));

    // Query for users with the selected gender filter
    if (filterData?.gender) {
      queries.push(Query.equal('gender', filterData?.gender));
    }

    // Query for users with the selected country filter
    if (filterData?.country) {
      queries.push(Query.equal('countryCode', filterData?.country));
    }

    // Query for users with birthdates between the selected min and max ages
    if (filterData?.minAge && filterData?.maxAge) {
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - filterData?.maxAge);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - filterData?.minAge);

      queries.push(Query.greaterThanEqual('birthdate', minDate.toISOString()));
      queries.push(Query.lessThanEqual('birthdate', maxDate.toISOString()));
    }

    // Query for users with the selected languages filter
    if (filterData?.languages.length > 0) {
      const keywords = filterData.languages.join(' ');
      // OR Query for users with any of the selected languages
      queries.push(Query.search('languageArray', keywords));
    }

    return this.appwrite.listDocuments(
      environment.appwrite.USERS_COLLECTION,
      queries
    );
  }

  //
  // Upload Bucket
  //

  uploadFile(file: any): Promise<any> {
    return this.storage.createFile(
      environment.appwrite.USER_BUCKET,
      ID.unique(),
      file
    );
  }
}
