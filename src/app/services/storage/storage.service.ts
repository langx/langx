import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Observable, from } from 'rxjs';

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

  public async set(key: string, value: any) {
    await this._storage?.set(key, value);
  }

  public async get(key: string): Promise<string> {
    let value = await this._storage?.get(key);
    return value;
  }
  
  public async remove(key: string){
    await this._storage?.remove(key);
  }

  public async clear(){
    await this._storage?.clear();
  }

  public async keys(key: string): Promise<any> {
    let value = await this._storage?.keys();
    return value;
  }

  public async length(key: string): Promise<number>{
    let value = await this._storage?.length();
    return value;
  }

} 