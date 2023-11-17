import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, LoadingController, ToastController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Message } from 'src/app/models/Message';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { getRoomByIdAction } from 'src/app/store/actions/room.action';
import {
  createMessageAction,
  getMessagesAction,
  getMessagesWithOffsetAction,
  deactivateRoomAction,
} from 'src/app/store/actions/message.action';
import {
  errorSelector,
  isLoadingSelector,
  messagesSelector,
  roomSelector,
  totalSelector,
  userDataSelector,
} from 'src/app/store/selectors/message.selector';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit {
  @ViewChild(IonContent) content: IonContent;
  loadingOverlay: HTMLIonLoadingElement;
  isLoadingOverlayActive = false;
  form: FormGroup;

  room$: Observable<RoomExtendedInterface | null>;
  user$: Observable<User | null>;
  currentUser$: Observable<User | null>;
  isLoading$: Observable<boolean>;
  messages$: Observable<Message[] | null>;
  total$: Observable<number | null> = null;

  isTyping: boolean = false;
  roomId: string;
  user: User; // TODO: Remove this

  model = {
    icon: 'chatbubbles-outline',
    title: 'No conversation',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
    // this.listMessages();
  }

  ngAfterViewInit() {
    // TODO: Needs optimization
    this.scrollToBottom();
    // console.log('ngAfterViewChecked');
  }

  ngOnDestroy() {
    this.room$
      .subscribe((room) => {
        if (room) {
          this.store.dispatch(deactivateRoomAction({ payload: room }));
        }
      })
      .unsubscribe();
  }

  initValues() {
    this.roomId = this.route.snapshot.paramMap.get('id');

    this.room$ = this.store.pipe(select(roomSelector));
    this.user$ = this.store.pipe(select(userDataSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.messages$ = this.store.pipe(select(messagesSelector));
    this.total$ = this.store.pipe(select(totalSelector));

    // TODO: Take a look here!
    // Check room$ and currentUser$ for null
    // this.room$
    //   .subscribe((room) => {
    //     if (!room) {
    //       this.currentUser$
    //         .subscribe((currentUser) => {
    //           this.store.dispatch(
    //             getRoomByIdAction({
    //               currentUserId: currentUser.$id,
    //               roomId: this.roomId,
    //             })
    //           );
    //         })
    //         .unsubscribe();
    //     }
    //   })
    //   .unsubscribe();

    // Loading Controller
    this.isLoading$.subscribe((isLoading) => {
      this.loadingController(isLoading);
    });

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
    this.currentUser$
      .subscribe((currentUser) => {
        this.user$
          .subscribe((user) => {
            const request: createMessageRequestInterface = {
              body: this.form.value.body,
              roomId: this.roomId,
              to: user.$id,
            };
            this.store.dispatch(
              createMessageAction({ request, currentUserId: currentUser.$id })
            );
            this.form.reset();
          })
          .unsubscribe();
      })
      .unsubscribe();
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

  // TODO: Fix this bug
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
  // Loading Controller
  //

  async loadingController(isLoading: boolean) {
    if (isLoading) {
      if (!this.loadingOverlay && !this.isLoadingOverlayActive) {
        this.isLoadingOverlayActive = true;
        this.loadingOverlay = await this.loadingCtrl.create({
          message: 'Please wait...',
        });
        await this.loadingOverlay.present();
        this.isLoadingOverlayActive = false;
      }
    } else if (
      this.loadingOverlay &&
      this.loadingOverlay.present &&
      !this.isLoadingOverlayActive
    ) {
      this.isLoadingOverlayActive = true;
      await this.loadingOverlay.dismiss();
      this.loadingOverlay = undefined;
      this.isLoadingOverlayActive = false;
    }
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
