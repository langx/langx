import { Injectable } from '@angular/core';
// import { Storage } from 'appwrite';
import { ImageGravity, Storage } from 'src/app/extras/sdk/src';
import { Preferences } from '@capacitor/preferences';

import { ApiService } from 'src/app/services/api/api.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  storage: Storage;

  constructor(private api: ApiService) {
    this.initStorage();
  }

  //
  // Appwrite Storage
  //

  initStorage() {
    this.storage = new Storage(this.api.client);
  }

  createFile(bucketId: string, fileId: string, file: any): Promise<any> {
    return this.storage.createFile(bucketId, fileId, file);
  }

  getFileView(bucketId: string, fileId: string): URL {
    return this.storage.getFileView(bucketId, fileId);
  }

  getFilePreview(bucketId: string, fileId: string): URL {
    return this.storage.getFilePreview(
      bucketId,
      fileId,
      190,
      190,
      ImageGravity.Center,
      45
    );
  }

  getFileDownload(bucketId: string, fileId: string): URL {
    return this.storage.getFileDownload(bucketId, fileId);
  }

  //
  // Capacitor Preferences
  //

  async setValue(key: string, value: string) {
    await Preferences.set({
      key: key,
      value: value,
    });
  }

  async getValue(key: string): Promise<string> {
    const { value } = await Preferences.get({ key: key });
    return value;
  }

  async removeValue(key: string) {
    await Preferences.remove({ key: key });
  }
}
