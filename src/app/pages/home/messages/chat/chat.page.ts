import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from 'src/app/services/auth/auth.service';
import { MessageService } from 'src/app/services/chat/message.service';
import { RoomService } from 'src/app/services/chat/room.service';
import { UserService } from 'src/app/services/user/user.service';

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

  currentUserId: string;
  roomId: string;
  userId: string;
  user: any;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No conversation',
    color: 'warning',
  };

  constructor(
    private authService: AuthService,
    private roomService: RoomService,
    private userService: UserService,
    private messageService: MessageService,
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

  initChatPage() {
    // get current user id
    this.currentUserId = this.authService.getUserId();

    // get room document id from route
    this.roomId = this.route.snapshot.paramMap.get('id');

    // get room document from db
    this.roomService
      .getRoom(this.roomId)
      .then((room) => {
        console.log('room: ', room);
        room.users.forEach((user) => {
          if (user !== this.currentUserId) this.userId = user;
        });

        // get user document from db
        this.userService
          .getUserDoc(this.userId)
          .then((user) => {
            console.log('user: ', user);
            this.user = user;
          })
          .catch((err) => {
            // Check if the user exists or not
            console.log('user error: ', err.message);
            this.presentToast('User not found', 'danger');
            this.router.navigateByUrl('/home/messages');
          });
      })
      .catch((err) => {
        // Check if the room exists or not
        console.log('room error: ', err.message);
        this.presentToast('Room not found', 'danger');
        this.router.navigateByUrl('/home/messages');
      });
  }

  addMessage() {
    console.log('roomID: ', this.roomId);
    let data = {
      to: this.userId,
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
