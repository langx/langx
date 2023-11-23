import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { Room } from 'src/app/models/Room';
import { Account } from 'src/app/models/Account';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { lastSeen } from 'src/app/extras/utils';
import { FcmService } from 'src/app/services/fcm/fcm.service';
import { accountSelector } from 'src/app/store/selectors/auth.selector';
import { activateRoomAction } from 'src/app/store/actions/message.action';
import {
  getRoomsAction,
  getRoomsWithOffsetAction,
} from 'src/app/store/actions/rooms.action';
import {
  isLoadingSelector,
  roomsSelector,
  totalSelector,
  errorSelector,
} from 'src/app/store/selectors/room.selector';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  subscription: Subscription;
  currentUser$: Observable<Account | null>;
  isLoading$: Observable<boolean>;
  rooms$: Observable<Room[] | null>;
  total$: Observable<number | null> = null;

  currentUserId: string = null;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private fcmService: FcmService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.initValues();
    // Trigger FCM
    this.fcmService.registerPush();
    // Get all chat Rooms
    this.listRooms();
    //await this.listRooms();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Present Toast if error
    this.subscription.add(
      this.store
        .pipe(select(errorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(accountSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.rooms$ = this.store.pipe(select(roomsSelector));
    this.total$ = this.store.pipe(select(totalSelector));

    // Set Current User Id
    this.currentUser$
      .subscribe((user) => {
        if (user) {
          this.currentUserId = user.$id;
        }
      })
      .unsubscribe();
  }

  listRooms() {
    this.currentUser$
      .subscribe((user) => {
        if (user) {
          const currentUserId = user.$id;
          this.store.dispatch(getRoomsAction({ currentUserId }));
        }
      })
      .unsubscribe();
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    let offset: number = 0;
    this.currentUser$
      .subscribe((user) => {
        let currentUserId: string;
        if (user) {
          currentUserId = user.$id;
        }
        this.rooms$
          .subscribe((users) => {
            if (!users) return;
            offset = users.length;
            this.total$
              .subscribe((total) => {
                if (offset < total) {
                  this.store.dispatch(
                    getRoomsWithOffsetAction({
                      currentUserId,
                      offset,
                    })
                  );
                } else {
                  console.log('All rooms loaded');
                }
              })
              .unsubscribe();
          })
          .unsubscribe();
      })
      .unsubscribe();

    event.target.complete();
  }

  getChat(room) {
    this.store.dispatch(activateRoomAction({ payload: room }));
  }

  openArchiveMessages() {
    console.log('openArchiveMessages clicked');
  }

  handleRefresh(event) {
    this.listRooms();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

  archiveChat(room) {
    console.log('archiveChat clicked', room);
  }

  getBadge(room): number {
    return room.messages.filter(
      (message) => message.seen === false && message.to === this.currentUserId
    ).length;
  }
  //
  // Utils
  //

  getLastMessage(room) {
    let lastMessage = {
      body: 'Say Hi! 👋',
      time: null,
    };
    if (room.messages.length > 0) {
      lastMessage.body = room.messages[room.messages.length - 1].body;
      lastMessage.time = room.messages[room.messages.length - 1].$updatedAt;
    }
    return lastMessage;
  }

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'now';
    return time;
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
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
