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

  listCheckouts(currentUser: User): Observable<listCheckoutsResponseInterface> {
    return from(
      this.api.listDocuments(environment.appwrite.WALLET_COLLECTION, [
        Query.equal('$id', currentUser.$id),
        Query.orderAsc('$createdAt'),
      ])
    );
  }
}
