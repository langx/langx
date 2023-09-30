import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { ID } from 'appwrite';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  constructor(private api: ApiService) {}

  getLanguageDoc(uid: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.LANGUAGES_COLLECTION, uid);
  }

  createLanguageDoc(data: any): Promise<any> {
    return this.api.createDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      ID.unique(),
      data
    );
  }

  updateLanguageDoc(uid: string, data: any): Promise<any> {
    return this.api.updateDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      uid,
      data
    );
  }

  deleteLanguageDoc(uid: string): Promise<any> {
    return this.api.deleteDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      uid
    );
  }
}
