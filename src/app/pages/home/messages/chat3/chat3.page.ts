import { Component, OnInit } from '@angular/core';
import { Chat3Service } from 'src/app/services/chat/chat3.service';
import { ID } from 'appwrite';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-chat3',
  templateUrl: './chat3.page.html',
  styleUrls: ['./chat3.page.scss'],
})
export class Chat3Page implements OnInit {
  message: string = '';
  isTyping: boolean = false;
  subscription: any;

  name: string;
  uid: string;
  chatID: string;
  currentUserId: string;

  constructor(
    private chatService: Chat3Service,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initChatPage();
    this.subscription = this.chatService.listenDocuments();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  initChatPage() {
    const data: any = this.route.snapshot.queryParams;
    console.log('route snapshot data: ', data);
    if (data?.name) this.name = data.name;
    if (data?.uid) this.uid = data.uid;
    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    this.chatID = chatRoomId;
    this.currentUserId = this.auth.getId();
  }

  addMessage() {
    const promise = this.chatService.createDocument({
      message: '!!! Hello World !!!',
      sender: this.currentUserId,
    });
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
