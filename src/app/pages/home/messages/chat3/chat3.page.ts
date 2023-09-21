import { Component, OnInit } from '@angular/core';
import { RoomService } from 'src/app/services/chat/room.service';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';
import { MessageService } from 'src/app/services/chat/message.service';

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
    private roomService: RoomService,
    private messageService: MessageService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initChatPage();
    this.initMessages();
    this.subscription = this.messageService.listenMessages(this.roomId);
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

  initMessages() {
    this.getMessages();
  }

  addMessage() {
    const data = {
      message: '!!! 3nd message !!!',
      sender: this.currentUserId,
    };
    console.log('roomId: ', this.roomId);
    const promise = this.roomService.updateRoom(this.roomId, {
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
    const promise = this.messageService.listMessages(this.roomId);
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
