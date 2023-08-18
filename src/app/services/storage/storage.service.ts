import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private _storage: Storage | null = null;

  constructor(private storage: Storage) {
    this.initStorage();
  }

  async initStorage() {
    // If using, define drivers here: await this.storage.defineDriver(/*...*/);
    const storage = await this.storage.create();
    this._storage = storage;
  }

  // Create and expose methods that users of this service can
  // call, for example:
  public async set(key: string, value: any) {
    let result = await this._storage?.set(key, value);
    console.log("result:", result);
  }

  public async get(key: string){
    let value = await this._storage?.get(key);
    console.log("value:", value);
    return value;
  }

  public async remove(key: string){
    await this._storage?.remove(key);
  }

  public async clear(){
    await this._storage?.clear();
  }

  public async keys(key: string){
    let value = await this._storage?.keys();
    return value;
  }

  public async length(key: string){
    let value = await this._storage?.length();
    return value;
  }

} 