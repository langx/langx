import { Injectable } from '@angular/core';
import { Storage } from 'appwrite';
import { AppwriteService } from '../appwrite/appwrite.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  storage: Storage;

  constructor(private appwrite: AppwriteService) {
    this.initStorage();
  }

  initStorage(): void {
    this.storage = new Storage(this.appwrite.client);
  }

  createFile(bucketId: string, fileId: string, file: any): Promise<any> {
    return this.storage.createFile(bucketId, fileId, file);
  }

  getFileView(bucketId: string, fileId: string): URL {
    return this.storage.getFileView(bucketId, fileId);
  }
}
