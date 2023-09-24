import { Injectable } from '@angular/core';
import { Client, ID, Databases, Account } from 'appwrite';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AppwriteService {
  client: Client = new Client();
  database: Databases;
  account: Account;

  constructor() {
    this.init();
    this.database = new Databases(this.client);
    this.account = new Account(this.client);
  }

  init(): void {
    this.client
      .setEndpoint(environment.appwrite.APP_ENDPOINT) // Your API Endpoint
      .setProject(environment.appwrite.APP_PROJECT); // Your project ID
  }

  // to subscribe to any channel
  client$(): Client {
    return this.client;
  }

  listDocuments(collectionId: string, queries?: string[]): Promise<any> {
    if (queries) {
      return this.database.listDocuments(
        environment.appwrite.APP_DATABASE,
        collectionId,
        queries
      );
    } else {
      return this.database.listDocuments(
        environment.appwrite.APP_DATABASE,
        collectionId
      );
    }
  }

  getDocument(collectionId: string, documentId: string): Promise<any> {
    return this.database.getDocument(
      environment.appwrite.APP_DATABASE,
      collectionId,
      documentId
    );
  }

  createDocument(collectionId: string, data: any): Promise<any> {
    return this.database.createDocument(
      environment.appwrite.APP_DATABASE,
      collectionId,
      data.uid,
      data
    );
  }

  updateDocument(
    collectionId: string,
    documentId: string,
    data: any
  ): Promise<any> {
    return this.database.updateDocument(
      environment.appwrite.APP_DATABASE,
      collectionId,
      documentId,
      data
    );
  }
}
