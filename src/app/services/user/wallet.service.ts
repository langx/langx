import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { Observable, from } from 'rxjs';
import axios from 'axios';

import { User } from 'src/app/models/User';
import { listWalletsResponseInterface } from 'src/app/models/types/responses/listWalletsResponse.interface';
import { ApiService } from 'src/app/services/api/api.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  constructor(private api: ApiService) {}

  getWallet(currentUser: User): Observable<listWalletsResponseInterface> {
    return from(
      this.api.listDocuments(environment.appwrite.WALLET_COLLECTION, [
        Query.equal('$id', currentUser.$id),
      ])
    );
  }

  listWallets(): Observable<listWalletsResponseInterface> {
    return from(
      axios.get(`${environment.api.LEADERBOARD}/token`).then((result) => {
        return result.data as listWalletsResponseInterface;
      })
    );
  }
}
