import { Injectable } from '@angular/core';
import { ID, Query } from 'appwrite';
import { Observable, forkJoin, from, of, switchMap } from 'rxjs';

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

    // TODO: #340 Query for users that are not blocked by the current user
    // TODO: No need to hide in UI, just don't show in the list here.
    // let blockedUsersQuery = blockedUsers.map(id => Query.notEqual('$id', id)).join(' and ');

    // Query for users descending by last seen
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

  blockUser(currentUser: User, userId: string): Observable<User> {
    return from(
      this.api.updateDocument(
        environment.appwrite.USERS_COLLECTION,
        currentUser.$id,
        {
          blockedUsers: [...currentUser.blockedUsers, userId],
        }
      )
    );
  }

  unBlockUser(currentUser: User, userId: string): Observable<User> {
    return from(
      this.api.updateDocument(
        environment.appwrite.USERS_COLLECTION,
        currentUser.$id,
        {
          blockedUsers: currentUser.blockedUsers.filter(
            (id) => id !== userId
          ),
        }
      )
    );
  }

  getBlockedUsers(blockedUsers: string[]): Observable<User[]> {
    // Create an array of Observables, each one gets a blocked user
    const userObservables = blockedUsers.map((userId) =>
      from(this.api.getDocument(environment.appwrite.USERS_COLLECTION, userId))
    );

    // Combine all the Observables into one
    return forkJoin(userObservables);
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
