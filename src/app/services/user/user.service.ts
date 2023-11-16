import { Injectable } from '@angular/core';
import { ID, Query } from 'appwrite';
import { BehaviorSubject, Observable, from } from 'rxjs';

import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { ApiService } from 'src/app/services/api/api.service';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/services/auth/auth.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import { User } from 'src/app/models/User';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  //TODO : Add model for user here
  private userDoc = new BehaviorSubject<any>(null);

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private storage: StorageService
  ) {}

  getEvent(): BehaviorSubject<any> {
    return this.userDoc;
  }

  setEvent(user: any): void {
    this.userDoc.next(user);
  }

  // TODO: It may be moved to notification service.
  // Listen to user
  listenUserDoc(userid: string) {
    const client = this.api.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.USERS_COLLECTION +
        '.documents.' +
        userid,
      (response) => {
        // console.log(response.payload);
        this.setEvent(response.payload);
      }
    );
  }

  getUserDoc2(uid: string): Observable<any> {
    return from(
      this.api.getDocument(environment.appwrite.USERS_COLLECTION, uid)
    );
  }

  getUserDoc(uid: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.USERS_COLLECTION, uid);
  }

  createUserDoc(uid: string, data: any): Observable<User> {
    return from(
      this.api.createDocument(environment.appwrite.USERS_COLLECTION, uid, data)
    );
  }

  updateUserDoc2(uid: string, data: any): Observable<any> {
    return from(
      this.api.updateDocument(environment.appwrite.USERS_COLLECTION, uid, data)
    );
  }

  updateUserDoc(uid: string, data: any): Promise<any> {
    return this.api.updateDocument(
      environment.appwrite.USERS_COLLECTION,
      uid,
      data
    );
  }

  listUsers(
    filterData: FilterDataInterface,
    offset?: number
  ): Observable<listUsersResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for users that are not the current user
    queries.push(Query.notEqual('$id', this.authService.getUserId()));

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

    // Limit and offset
    queries.push(Query.limit(environment.opts.PAGINATION_LIMIT));
    if (offset) queries.push(Query.offset(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
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

  getFileView(fileId: string): URL {
    return this.storage.getFileView(environment.appwrite.USER_BUCKET, fileId);
  }
}
