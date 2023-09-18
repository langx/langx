import { Injectable } from '@angular/core';
import { Client, Account, ID, Databases } from 'appwrite';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AppwriteService {
  client: Client = new Client();
  databases: Databases;

  constructor() {
    this.init();
    this.databases = new Databases(this.client);
  }

  init(): void {
    this.client
      .setEndpoint(environment.appwrite.APP_ENDPOINT) // Your API Endpoint
      .setProject(environment.appwrite.APP_PROJECT); // Your project ID
  }

  listDocuments(collectionId: string): Promise<any> {
    return this.databases.listDocuments(
      environment.appwrite.APP_DATABASE,
      collectionId
    );
  }
  /*
  createDocument(collectionId: string, data: any): Promise<any> {
    return this.databases.createDocument(
      environment.appwrite.APP_DATABASE,
      collectionId,
      ID.unique(),
      data
    );
  }
*/
}
