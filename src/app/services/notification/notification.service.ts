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
    let channels = [];

    // channel for rooms
    const c1 =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.ROOMS_COLLECTION +
      '.documents';
    // channel for messages
    const c2 =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.MESSAGES_COLLECTION +
      '.documents';

    // add channels to array
    channels.push(c1);
    channels.push(c2);

    const client = this.api.client$();
    return client.subscribe(channels, (response) => {
      console.log('listener response', response);
    });
  }
}
