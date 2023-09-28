import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { MessageService } from 'src/app/services/chat/message.service';

@Component({
  selector: 'app-chat3',
  templateUrl: './chat3.page.html',
  styleUrls: ['./chat3.page.scss'],
})
export class Chat3Page implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  messages: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  message: string = '';

  isTyping: boolean = false;
  listenWSS: any;

  name: string;
  uid: string;
  roomId: string;
  currentUserId: string;

  constructor(
    private messageService: MessageService,
    private auth2Service: Auth2Service,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initChatPage();

    this.messageService.listMessages(this.roomId);
    this.messages = this.messageService.messages;
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  // TODO: Check if the room exists or not
  // Client side params are set, such as name, uid, roomId
  initChatPage() {
    const data: any = this.route.snapshot.queryParams;
    console.log('route snapshot data: ', data);
    if (data?.name) this.name = data.name;
    if (data?.uid) this.uid = data.uid;
    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    this.roomId = chatRoomId;
    this.currentUserId = this.auth2Service.getUserId();
  }

  addMessage() {
    console.log('roomID: ', this.roomId);
    const data = {
      body: this.message,
      sender: this.currentUserId,
      roomId: this.roomId,
    };
    // Add loading indicator
    this.messageService.pushMessage(data);
    const promise = this.messageService.createMessage(data);
    promise.then(
      (response) => {
        console.log(response); // Success
        this.message = '';
        // It pulls down
        this.scrollToBottom();
      },
      (error) => {
        // TODO: Add toast message here
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

  scrollToBottom() {
    this.content.scrollToBottom(100);
  }
}
