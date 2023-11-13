import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Message } from 'src/app/models/Message';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  createMessageAction,
  getMessagesAction,
  getMessagesWithOffsetAction,
} from 'src/app/store/actions/message.action';
import {
  errorSelector,
  isLoadingSelector,
  messagesSelector,
  totalSelector,
} from 'src/app/store/selectors/message.selector';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit {
  @ViewChild(IonContent) content: IonContent;
  form: FormGroup;

  currentUser$: Observable<User | null>;
  isLoading$: Observable<boolean>;
  messages$: Observable<Message[] | null>;
  total$: Observable<number | null> = null;

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
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
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
    this.total$ = this.store.pipe(select(totalSelector));

    // Present Toast if error
    this.store
      .pipe(select(errorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error) {
          this.presentToast(error.message, 'danger');
        }
      });
  }

  initForm() {
    this.form = new FormGroup({
      body: new FormControl('', {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
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
        this.total$
          .subscribe((total) => {
            if (offset < total) {
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

  createMessage() {
    console.log('createMessage clicked');
    let request = {
      currentUserId: 'this.currentUserId',
      to: 'this.userId',
      body: 'this.message',
      roomId: 'this.roomId',
    };
    // this.store.dispatch(createMessageAction({ roomId: this.roomId }));
  }

  /*
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
  */

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
