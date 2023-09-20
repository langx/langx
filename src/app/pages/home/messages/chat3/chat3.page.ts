import { Component, OnInit } from '@angular/core';
import { Chat3Service } from 'src/app/services/chat/chat3.service';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-chat3',
  templateUrl: './chat3.page.html',
  styleUrls: ['./chat3.page.scss'],
})
export class Chat3Page implements OnInit {
  message: string = '';
  messages: any[] = [];
  isTyping: boolean = false;
  subscription: any;

  name: string;
  uid: string;
  roomId: string;
  currentUserId: string;

  constructor(
    private chat3Service: Chat3Service,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initChatPage();
    this.subscription = this.chat3Service.listenMessages(this.roomId);
  }

  ngOnDestroy() {
    this.subscription(); // to unsubscribe
  }

  initChatPage() {
    const data: any = this.route.snapshot.queryParams;
    console.log('route snapshot data: ', data);
    if (data?.name) this.name = data.name;
    if (data?.uid) this.uid = data.uid;
    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    this.roomId = chatRoomId;
    this.currentUserId = this.auth.getId();
  }

  addMessage() {
    const data = {
      message: '!!! 3nd message !!!',
      sender: this.currentUserId,
    };
    console.log('roomId: ', this.roomId);
    const promise = this.chat3Service.updateRoom(this.roomId, {
      messages: [...this.messages, data],
    });
    promise.then(
      (response) => {
        console.log(response); // Success
      },
      (error) => {
        console.log(error); // Failure
      }
    );
  }

  getMessages() {
    const promise = this.chat3Service.listMessages(this.roomId);
    promise.then(
      (response) => {
        console.log(response.documents[0].messages); // Success
        this.messages = response.documents[0].messages;
      },
      (error) => {
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
