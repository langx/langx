import { Injectable } from '@angular/core';
import { ID } from 'appwrite';
import { Observable, from } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { Language } from 'src/app/models/Language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  constructor(private api: ApiService) {}

  getLanguageDoc(uid: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.LANGUAGES_COLLECTION, uid);
  }

  createLanguageDoc(data: any): Observable<any> {
    return from(
      this.api.createDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        ID.unique(),
        data
      )
    );
  }

  // It is triggerred by edit.page.ts
  createLanguageDocWithUpdatingLanguageArray(data: any): Observable<Language> {
    return from(
      this.api.createDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        ID.unique(),
        data
      )
    );
  }

  updateLanguageDoc(uid: string, data: any): Observable<Language> {
    return from(
      this.api.updateDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        uid,
        data
      )
    );
  }

  deleteLanguageDoc(uid: string): Promise<any> {
    return this.api.deleteDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      uid
    );
  }
}
