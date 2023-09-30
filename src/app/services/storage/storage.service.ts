import { Injectable } from '@angular/core';
import { Storage } from 'appwrite';
import { ApiService } from '../api/api.service';
import { Storage as localStorage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private _storage: localStorage | null = null;
  storage: Storage;

  constructor(private api: ApiService, private localStorage: localStorage) {
    this.initStorage();
    this.initLocalStorage();
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

  //
  // Local Storage
  // TODO: Seperate this into a seperate service
  //

  async initLocalStorage() {
    // If using, define drivers here: await this.storage.defineDriver(/*...*/);
    const storage = await this.localStorage.create();
    this._storage = storage;
  }

  public async set(key: string, value: any) {
    await this._storage?.set(key, value);
  }

  public async get(key: string): Promise<string> {
    let value = await this._storage?.get(key);
    return value;
  }

  public async remove(key: string) {
    await this._storage?.remove(key);
  }

  public async clear() {
    await this._storage?.clear();
  }

  public async keys(key: string): Promise<any> {
    let value = await this._storage?.keys();
    return value;
  }

  public async length(key: string): Promise<number> {
    let value = await this._storage?.length();
    return value;
  }
}
