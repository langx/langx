import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { Observable, from } from 'rxjs';

import { ApiService } from 'src/app/services/api/api.service';

import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';
import { listCheckoutsResponseInterface } from 'src/app/models/types/responses/listCheckoutsResponse.interface';

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  constructor(private api: ApiService) {}

  //
  // List Checkouts
  //

  listCheckouts(
    currentUser: User,
    offset?: number
  ): Observable<listCheckoutsResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for user is not deleted
    queries.push(Query.equal('userId', currentUser.$id));

    // Query for users descending by last seen
    queries.push(Query.orderDesc('$createdAt'));

    // Add pagination queries
    queries.push(...this.createPaginationQueries(offset));
    return from(
      this.api.listDocuments(environment.appwrite.CHECKOUT_COLLECTION, queries)
    );
  }

  //
  // Utils
  //

  private createPaginationQueries(offset?: number): any[] {
    const queries: any[] = [];

    // Limit query
    queries.push(Query.limit(environment.opts.PAGINATION_LIMIT));

    // Offset query
    if (offset) queries.push(Query.offset(offset));

    return queries;
  }
}
