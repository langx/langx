import { Injectable } from '@angular/core';
// import { ID, Query } from 'appwrite';
import { ID, Query } from 'src/app/extras/sdk/src';
import { Observable, forkJoin, from, of, switchMap } from 'rxjs';

// Environment and Services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { StorageService } from 'src/app/services/storage/storage.service';

// Interface Imports
import { User } from 'src/app/models/User';
import { Report } from 'src/app/models/Report';
import { BucketFile } from 'src/app/models/BucketFile';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { listVisitsResponseInterface } from 'src/app/models/types/responses/listVisitsResponse.interface';
import { listStreaksResponseInterface } from 'src/app/models/types/responses/listStreaksResponse.interface';

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
    // TODO: Delete Test Function Call after testing
    this.api.function
      .createExecution('update-user', JSON.stringify(data))
      .then((response) => {
        console.log('update-user', response);
      });
    this.api
      .updateDocument(environment.appwrite.USERS_COLLECTION, uid, data)
      .then((response) => {
        console.log('updateDocument', response);
      });

    return from(
      this.api.updateDocument(environment.appwrite.USERS_COLLECTION, uid, data)
    );
  }

  listUsersByTargetLanguage(
    currentUser: User,
    filterData: FilterDataInterface,
    offset?: number
  ): Observable<listUsersResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Add exclusion queries
    queries.push(...this.createExclusionQueries(currentUser));

    // Query for users with the selected languages filter
    if (currentUser?.languageArray.length > 0) {
      const keywords = currentUser.languageArray;
      // OR Query for users with any of the selected languages
      queries.push(Query.contains('languageArray', keywords));
    }
    // Query for not equal same country
    queries.push(Query.notEqual('countryCode', currentUser['countryCode']));

    // Query for users descending by last seen
    queries.push(Query.orderDesc('lastSeen'));

    // Add filter data queries
    queries.push(...this.createFilterQueries(filterData));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
    );
  }

  listUsersByCompletedProfile(
    currentUser: User,
    filterData: FilterDataInterface,
    offset?: number
  ): Observable<listUsersResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Add exclusion queries
    queries.push(...this.createExclusionQueries(currentUser));

    // Query for users with completed profiles
    queries.push(Query.notEqual('aboutMe', ''));
    queries.push(
      Query.notEqual('profilePhoto', environment.defaultAssets.PROFILE_PHOTO)
    );

    // Query for users descending by last seen
    queries.push(Query.orderDesc('lastSeen'));

    // Add filter data queries
    queries.push(...this.createFilterQueries(filterData));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
    );
  }

  listUsersByLastSeen(
    currentUser: User,
    filterData: FilterDataInterface,
    offset?: number
  ): Observable<listUsersResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Add exclusion queries
    queries.push(...this.createExclusionQueries(currentUser));

    // Query for users descending by last seen
    queries.push(Query.orderDesc('lastSeen'));

    // Add filter data queries
    queries.push(...this.createFilterQueries(filterData));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
    );
  }

  listUsersByCreatedAt(
    currentUser: User,
    filterData: FilterDataInterface,
    offset?: number
  ): Observable<listUsersResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Add exclusion queries
    queries.push(...this.createExclusionQueries(currentUser));

    // Query for users descending by created at
    queries.push(Query.orderDesc('$createdAt'));

    // Add filter data queries
    queries.push(...this.createFilterQueries(filterData));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
    );
  }

  //
  // Visits
  //

  createVisitDoc(currentUserId: string, userId: string): Observable<any> {
    if (currentUserId === userId) {
      return of(null);
    }

    return from(
      this.api.createDocument(
        environment.appwrite.VISITS_COLLECTION,
        ID.unique(),
        {
          from: currentUserId,
          to: userId,
        }
      )
    );
  }

  listVisits(
    currentUserId: string,
    offset?: number
  ): Observable<listVisitsResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for users that are not the current user
    queries.push(Query.equal('to', currentUserId));

    // Query for users descending by last seen
    queries.push(Query.orderDesc('$updatedAt'));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.VISITS_COLLECTION, queries)
    );
  }

  //
  // List Streaks
  //

  listStreaks(offset?: number): Observable<listStreaksResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for user is not deleted
    queries.push(Query.isNotNull('userId'));

    // Query for users descending by last seen
    queries.push(Query.orderDesc('daystreak'));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.STREAKS_COLLECTION, queries)
    );
  }

  //
  // Contributors
  //

  listContributors(offset?: number): Observable<listVisitsResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for users that have at least one of the specified roles in the 'contributors' array
    queries.push(
      Query.contains('contributors', [
        'codebase',
        'moderator',
        'marketing',
        'storyteller',
        'design',
        'accessibility',
        'user-relations',
        'growth-hacker',
        'website',
        'social-media',
        'tester',
      ])
    );

    // Query for users descending by last seen
    queries.push(Query.orderDesc('lastSeen'));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
    );
  }

  listSponsors(offset?: number): Observable<listVisitsResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for users that are not the current user
    queries.push(Query.equal('sponsor', true));

    // Query for users descending by last seen
    queries.push(Query.orderDesc('lastSeen'));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));

    return from(
      this.api.listDocuments(environment.appwrite.USERS_COLLECTION, queries)
    );
  }

  //
  // Block and Report User
  //

  blockUser(currentUser: User, userId: string): Observable<User> {
    return from(
      this.api.updateDocument(
        environment.appwrite.USERS_COLLECTION,
        currentUser.$id,
        {
          blockedUsers: [...currentUser?.blockedUsers, userId],
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
          blockedUsers: currentUser.blockedUsers.filter((id) => id !== userId),
        }
      )
    );
  }

  reportUser(
    currentUserId: string,
    userId: string,
    reason: string
  ): Observable<Report> {
    return from(
      this.api.createDocument(
        environment.appwrite.REPORTS_COLLECTION,
        ID.unique(),
        {
          reason: reason,
          to: userId,
          sender: currentUserId,
        }
      )
    );
  }

  getBlockedUsers(blockedUsers: string[]): Observable<User[]> {
    if (blockedUsers.length === 0) {
      return of([]);
    }

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

  //
  // Private Functions
  //

  private createExclusionQueries(currentUser: User): any[] {
    const queries: any[] = [];

    // Query for users that are not the current user
    queries.push(Query.notEqual('$id', currentUser.$id));

    // Query for users that are not blocked by the current user
    if (currentUser?.blockedUsers) {
      currentUser.blockedUsers.forEach((id) => {
        queries.push(Query.notEqual('$id', id));
      });
    }

    return queries;
  }

  private createFilterQueries(filterData: FilterDataInterface): any[] {
    const queries: any[] = [];

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
      const keywords = filterData.languages;
      // OR Query for users with any of the selected languages
      queries.push(Query.contains('languageArray', keywords));
    }

    return queries;
  }

  private createPaginationQueries(offset?: number): any[] {
    const queries: any[] = [];

    // Limit query
    queries.push(Query.limit(environment.opts.PAGINATION_LIMIT));

    // Offset query
    if (offset) queries.push(Query.offset(offset));

    return queries;
  }
}
