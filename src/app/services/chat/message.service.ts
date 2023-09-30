import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { environment } from 'src/environments/environment';
import { ID, Query } from 'appwrite';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);

  constructor(private api: ApiService) {}

  // Listen to messages in a room
  listenMessages(roomID: string) {
    const client = this.api.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.MESSAGES_COLLECTION +
        '.documents',
      (response) => {
        console.log(response);
        this.pushMessage(response.payload);
      }
    );
  }

  // Push a message to the messages behavior subject
  pushMessage(message) {
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
    // Listen for new messages
    this.listenMessages(roomId);
  }

  // Create a message
  createMessage(data: any): Promise<any> {
    return this.api.createDocument(
      environment.appwrite.MESSAGES_COLLECTION,
      ID.unique(),
      data
    );
  }
}
