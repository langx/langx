import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import axios from 'axios';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);

  constructor(private api: ApiService, private authService: AuthService) {}

  // Update messages behavior subject
  updateMessages(message) {
    const currentMessages = this.messages.getValue();

    const existingMessage = currentMessages.find(
      (msg) =>
        msg.sender === message.sender &&
        msg.body === message.body &&
        !msg.$createdAt
    );

    if (existingMessage) {
      // Update the existing message item in the array
      const updatedMessages = currentMessages.map((msg) => {
        if (msg === existingMessage) {
          return { ...msg, $createdAt: message.$createdAt };
        }
        return msg;
      });
      this.messages.next(updatedMessages);
    } else {
      // Add the new message item to the array
      const newMessages = [...currentMessages, message];
      this.messages.next(newMessages);
    }
  }

  // Get messages from a room to initialize the chat
  listMessages(roomId: string) {
    const promise = this.api.listDocuments(
      environment.appwrite.MESSAGES_COLLECTION,
      [Query.equal('roomId', roomId), Query.orderDesc('$createdAt')]
    );
    promise.then(
      (response) => {
        this.messages.next(response.documents.reverse());
      },
      (error) => {
        console.log(error); // Failure
      }
    );
  }

  // Create a message
  async createMessage(data: any): Promise<any> {
    // Set x-appwrite-user-id header
    const currentUserId = this.authService.getUserId();
    axios.defaults.headers.common['x-appwrite-user-id'] = currentUserId;

    // Set x-appwrite-jwt header
    await this.authService.createJWT().then((result) => {
      console.log('result: ', result);
      axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
    });

    // Call the /api/message
    return axios
      .post('https://api.languagexchange.net/api/message', data)
      .then((result) => {
        console.log('result: ', result);
        return result.data;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  // Listen to messages in a room
  listenMessages() {
    console.log('listenMessages started');
    const client = this.api.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.MESSAGES_COLLECTION +
        '.documents',
      (response) => {
        console.log(response);
        this.updateMessages(response.payload);
      }
    );
  }
}
