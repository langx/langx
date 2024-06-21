import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { NavigationEnd, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Observable, Subscription, combineLatest, map } from 'rxjs';

// Import Models and Services
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { updateRoomRequestInterface } from 'src/app/models/types/requests/updateRoomRequest.interface';
import { FcmService } from 'src/app/services/fcm/fcm.service';

// Import Actions and Selectors
import { activateRoomAction } from 'src/app/store/actions/message.action';
import {
  archiveRoomAction,
  archiveRoomInitialStateAction,
  clearErrorsAction,
  updateRoomAction,
} from 'src/app/store/actions/room.action';
import {
  getRoomsAction,
  getRoomsWithOffsetAction,
} from 'src/app/store/actions/rooms.action';
import {
  archiveRoomErrorSelector,
  currentUserSelector,
  totalUnseenArchivedSelector,
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
  totalUnseenArchived$: Observable<number | null> = null;
  filteredRooms$: Observable<Room[] | null> = null;

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
    // Get all chat Rooms
    this.listRooms();

    // Trigger FCM registration
    if (Capacitor.getPlatform() === 'web') {
      this.registerPushForWeb();
    } else {
      this.fcmService.registerPush();
    }

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && event.url === '/home/messages') {
        this.listRooms();
      }
    });
  }

  registerPushForWeb() {
    this.fcmService.registerPushForWeb();
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
            this.store.dispatch(clearErrorsAction());
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
    this.totalUnseenArchived$ = this.store.pipe(
      select(totalUnseenArchivedSelector)
    );

    this.filteredRooms$ = combineLatest([this.rooms$, this.currentUser$]).pipe(
      map(([rooms, currentUser]) => {
        if (!rooms) {
          return null;
        }
        return rooms.filter(
          (room) =>
            !currentUser.blockedUsers.includes(room?.['userData']?.$id) &&
            !currentUser.archivedRooms.includes(room.$id)
        );
      })
    );

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
    // console.log('Listing rooms');
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
      duration: 1000,
      position: 'top',
    });

    await toast.present();
  }
}
