import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { Observable, from } from 'rxjs';

import { User } from 'src/app/models/User';
import { listWalletResponseInterface } from 'src/app/models/types/responses/listWalletResponse.interface';
import { ApiService } from 'src/app/services/api/api.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  constructor(private api: ApiService) {}

  listWallet(currentUser: User): Observable<listWalletResponseInterface> {
    return from(
      this.api.listDocuments(environment.appwrite.WALLET_COLLECTION, [
        Query.equal('$id', currentUser.$id),
      ])
    );
  }
}
