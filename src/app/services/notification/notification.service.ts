import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private api: ApiService) {}

  listen() {
    console.log('listener started');
    const client = this.api.client$();
    return client.subscribe(
      'databases.' + environment.appwrite.APP_DATABASE,
      (response) => {
        console.log(response);
      }
    );
  }
}
