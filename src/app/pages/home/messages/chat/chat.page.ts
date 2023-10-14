import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from 'src/app/services/auth/auth.service';
import { MessageService } from 'src/app/services/chat/message.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  messages: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  message: string = '';

  isTyping: boolean = false;

  name: string;
  uid: string;
  roomId: string;
  currentUserId: string;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No conversation',
    color: 'warning',
  };

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController
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
    this.currentUserId = this.authService.getUserId();
  }

  addMessage() {
    console.log('roomID: ', this.roomId);
    let data = {
      to: this.uid,
      body: this.message,
      roomId: this.roomId,
    };
    let dataWithUserData = {
      ...data,
      sender: this.currentUserId,
    };
    // Add loading indicator
    this.messageService.updateMessages(dataWithUserData);
    const promise = this.messageService.createMessage(data);
    promise.then(
      (response) => {
        console.log(response); // Success
        this.message = '';
        // It pulls down
        this.scrollToBottom();
      },
      (error) => {
        console.log('error: ', error.message); // Failure
        this.presentToast('Error: ' + error.message, 'danger');
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

  // Navigate to user profile page
  goProfile(uid: string) {
    console.log('goProfile clicked');
    console.log('uid: ', uid);
    this.router.navigateByUrl(`/home/user/${uid}`);
  }

  // TODO: Do we need this function?
  search() {
    console.log('test clicked', this.content);
    // TODO: We already have global scroll to bottom function
    this.content.scrollToBottom(1500).then(() => {
      console.log('scrolled to bottom');
    });
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
