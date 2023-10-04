import { Injectable } from '@angular/core';
import { Client, Databases, Account } from 'appwrite';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
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

  // TODO: check if this is needed, or if we can use directly the this.client
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

  createDocument(
    collectionId: string,
    documentId: string,
    data: any,
    permissions?: string[],
  ): Promise<any> {
    return this.database.createDocument(
      environment.appwrite.APP_DATABASE,
      collectionId,
      documentId,
      data,
      permissions
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

  deleteDocument(collectionId: string, documentId: string): Promise<any> {
    return this.database.deleteDocument(
      environment.appwrite.APP_DATABASE,
      collectionId,
      documentId
    );
  }
}
