import { Injectable } from '@angular/core';
import { ID, Query } from 'appwrite';
import { Observable, from, of, switchMap } from 'rxjs';

// Environment and Services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { StorageService } from 'src/app/services/storage/storage.service';

// Interface Imports
import { User } from 'src/app/models/User';
import { BucketFile } from 'src/app/models/BucketFile';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(private api: ApiService, private storage: StorageService) {}

  getUserDoc(uid: string): Observable<any> {
    return from(
      this.api.getDocument(environment.appwrite.USERS_COLLECTION, uid)
    );
  }

  createUserDoc(uid: string, data: any): Observable<User> {
    return from(
      this.api.createDocument(environment.appwrite.USERS_COLLECTION, uid, data)
    );
  }

  updateUserDoc(uid: string, data: any): Observable<User> {
    return from(
      this.api.updateDocument(environment.appwrite.USERS_COLLECTION, uid, data)
    );
  }

  listUsers(
    currentUserId: string,
    filterData: FilterDataInterface,
    offset?: number
  ): Observable<listUsersResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for users that are not the current user
    queries.push(Query.notEqual('$id', currentUserId));

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

  uploadFile(request: File): Observable<URL> {
    return from(
      this.storage.createFile(
        environment.appwrite.USER_BUCKET,
        ID.unique(),
        request
      )
    ).pipe(switchMap((response: BucketFile) => this.getFileView(response.$id)));
  }

  private getFileView(fileId: string): Observable<URL> {
    const url = this.storage.getFileView(
      environment.appwrite.USER_BUCKET,
      fileId
    );
    return of(url);
  }
}
