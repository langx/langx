import { Injectable } from '@angular/core';
import { Client, Databases, Account, Locale } from 'appwrite';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  client: Client = new Client();
  database: Databases;
  account: Account;
  locale: Locale;

  constructor(private http: HttpClient) {
    this.init();
  }

  init(): void {
    this.client
      .setEndpoint(environment.appwrite.APP_ENDPOINT) // Your API Endpoint
      .setProject(environment.appwrite.APP_PROJECT); // Your project ID

    this.database = new Databases(this.client);
    this.account = new Account(this.client);
    this.locale = new Locale(this.client);
  }

  // TODO: check if this is needed, or if we can use directly the this.client
  // to subscribe to any channel
  client$(): Client {
    return this.client;
  }

  setJWT(jwt: string): void {
    this.client.setJWT(jwt);
    // TODO: Disable this console.log
    console.log('JWT set');
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
    permissions?: string[]
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

  // Rest API
  createJWTSession(jwt: string): Observable<any> {
    const url = `${environment.appwrite.APP_ENDPOINT}/account`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Appwrite-Response-Format': '1.4.0',
      'X-Appwrite-Project': environment.appwrite.APP_PROJECT,
      'X-Appwrite-JWT': jwt,
    });
    return this.http.get(url, { headers });
  }

  // Locale API
  listCountries(): Promise<any> {
    return this.locale.listCountries();
  }

  listLanguages(): Promise<any> {
    return this.locale.listLanguages();
  }
}
