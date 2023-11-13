import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Message } from 'src/app/models/Message';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { MessageService } from 'src/app/services/chat/message.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getMessagesAction,
  getMessagesWithOffsetAction,
} from 'src/app/store/actions/room.action';
import {
  errorMessagesSelector,
  isLoadingSelector,
  messagesSelector,
  totalMessagesSelector,
} from 'src/app/store/selectors/room.selector';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit {
  @ViewChild(IonContent) content: IonContent;

  currentUser$: Observable<User | null>;
  isLoading$: Observable<boolean>;
  messages$: Observable<Message[] | null>;
  totalMessages$: Observable<number | null> = null;

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
    private store: Store,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    this.listMessages();
  }

  ngAfterViewInit() {
    // TODO: Needs optimization
    this.scrollToBottom();
    // console.log('ngAfterViewChecked');
  }

  initValues() {
    this.roomId = this.route.snapshot.paramMap.get('id');

    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.messages$ = this.store.pipe(select(messagesSelector));
    this.totalMessages$ = this.store.pipe(select(totalMessagesSelector));

    // Present Toast if error
    this.store
      .pipe(select(errorMessagesSelector))
      .subscribe((error: ErrorInterface) => {
        if (error) {
          this.presentToast(error.message, 'danger');
        }
      });
  }

  listMessages() {
    this.store.dispatch(getMessagesAction({ roomId: this.roomId }));
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of messages that we already have
    let offset: number = 0;

    this.messages$
      .subscribe((messages) => {
        offset = messages.length;
        this.totalMessages$
          .subscribe((totalMessages) => {
            if (offset < totalMessages) {
              this.store.dispatch(
                getMessagesWithOffsetAction({
                  roomId: this.roomId,
                  offset: offset,
                })
              );
            } else {
              event.target.disabled = true;
              console.log('All messages loaded');
            }
          })
          .unsubscribe();
      })
      .unsubscribe();

    event.target.complete();
  }

  /*
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

  */

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
    this.content.scrollToBottom(300);
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
