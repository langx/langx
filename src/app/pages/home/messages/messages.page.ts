import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

// Import Models and Services
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FcmService } from 'src/app/services/fcm/fcm.service';

// Import Actions and Selectors
import { activateRoomAction } from 'src/app/store/actions/message.action';
import {
  archiveRoomAction,
  archiveRoomInitialStateAction,
} from 'src/app/store/actions/room.action';
import {
  getRoomsAction,
  getRoomsWithOffsetAction,
} from 'src/app/store/actions/rooms.action';
import {
  archiveRoomErrorSelector,
  currentUserSelector,
} from 'src/app/store/selectors/auth.selector';
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
  currentUser$: Observable<User | null>;
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
    private router: Router,
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

    this.subscription.add(
      this.store.pipe(select(archiveRoomErrorSelector)).subscribe((error) => {
        if (error) {
          this.presentToast(error.message, 'danger');
          this.store.dispatch(archiveRoomInitialStateAction());
        }
      })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
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
    this.store.dispatch(getRoomsAction());
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    let offset: number = 0;

    this.rooms$
      .subscribe((users) => {
        if (!users) return;
        offset = users.length;
        this.total$
          .subscribe((total) => {
            if (offset < total) {
              this.store.dispatch(
                getRoomsWithOffsetAction({
                  request: { offset },
                })
              );
            } else {
              console.log('All rooms loaded');
            }
          })
          .unsubscribe();
      })
      .unsubscribe();

    event.target.complete();
  }

  getChat(room) {
    this.store.dispatch(activateRoomAction({ payload: room }));
  }

  handleRefresh(event) {
    this.listRooms();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

  openArchiveChatPage() {
    this.router.navigate(['home/messages/archive']);
  }

  archiveRoom(room: Room) {
    // Dispatch action
    const request = { roomId: room.$id };
    this.store.dispatch(archiveRoomAction({ request }));
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
