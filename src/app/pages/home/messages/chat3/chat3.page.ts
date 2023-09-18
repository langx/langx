import { Component, OnInit } from '@angular/core';
import { Chat3Service } from 'src/app/services/chat/chat3.service';
import { Client, Databases, ID } from 'appwrite';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-chat3',
  templateUrl: './chat3.page.html',
  styleUrls: ['./chat3.page.scss'],
})
export class Chat3Page implements OnInit {
  message: string = '';
  isTyping: boolean = false;
  subscription: any;

  constructor(private chatService: Chat3Service) {}

  ngOnInit() {
    this.subscription = this.chatService.listenDocuments();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  addMessage() {
    const client = new Client();

    const databases = new Databases(client);

    client
      .setEndpoint(environment.appwrite.APP_ENDPOINT) // Your API Endpoint
      .setProject(environment.appwrite.APP_PROJECT); // Your project ID

    const promise = databases.createDocument(
      environment.appwrite.APP_DATABASE,
      '65075108a4025a4f5bd7',
      ID.unique(),
      {
        message: 'Hello World',
        sender: ID.unique(),
      }
    );

    promise.then(
      function (response) {
        console.log(response); // Success
      },
      function (error) {
        console.log(error); // Failure
      }
    );
  }

  getMessages() {
    const promise = this.chatService.listDocuments();
    promise.then(
      function (response) {
        console.log(response); // Success
      },
      function (error) {
        console.log(error); // Failure
      }
    );
    /*
    const client = new Client();
    const databases = new Databases(client);
    client
      .setEndpoint(environment.appwrite.APP_ENDPOINT) // Your API Endpoint
      .setProject(environment.appwrite.APP_PROJECT); // Your project ID

    client.subscribe('documents', (response) => {
      if (
        response.events.includes('databases.default.collections.*.documents.*.update')
      ) {
        // Log when a new file is uploaded
        console.log(response.payload);
      }
    });
    */
  }

  typingFocus() {
    this.isTyping = true;
    this.onTypingStatusChange();
  }

  typingBlur() {
    this.isTyping = false;
    this.onTypingStatusChange();
  }

  onTypingStatusChange() {
    console.log('onTypingStatusChange', this.isTyping);
  }
}
