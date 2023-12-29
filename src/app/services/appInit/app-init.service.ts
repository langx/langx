import { Injectable } from '@angular/core';

import { ApiService } from 'src/app/services/api/api.service';
import { StorageService } from '../storage/storage.service';

@Injectable({
  providedIn: 'root',
})
export class AppInitService {
  constructor(
    private api: ApiService,
    private storageService: StorageService
  ) {}

  init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.checkUserToken()
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async checkUserToken(): Promise<void> {
    return this.storageService.getValue('userToken').then((userToken) => {
      if (userToken) {
        console.log('userToken found: ', userToken);
        this.api.setJWT(userToken);
      }
    });
  }
}
