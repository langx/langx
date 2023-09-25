import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { ID } from 'appwrite';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  constructor(private appwrite: AppwriteService) {}

  getLanguageDoc(uid: string): Promise<any> {
    return this.appwrite.getDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      uid
    );
  }

  createLanguageDoc(data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      ID.unique(),
      data
    );
  }

  updateLanguageDoc(uid: string, data: any): Promise<any> {
    return this.appwrite.updateDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      uid,
      data
    );
  }
}
