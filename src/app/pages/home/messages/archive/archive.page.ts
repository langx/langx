import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, combineLatest, map } from 'rxjs';

import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { activateRoomAction } from 'src/app/store/actions/message.action';
import {
  unArchiveRoomAction,
  unArchiveRoomInitialStateAction,
} from 'src/app/store/actions/room.action';
import {
  getRoomsAction,
  getRoomsWithOffsetAction,
} from 'src/app/store/actions/rooms.action';
import {
  currentUserSelector,
  unArchiveRoomErrorSelector,
} from 'src/app/store/selectors/auth.selector';
import {
  errorSelector,
  isLoadingSelector,
  roomsSelector,
  totalSelector,
} from 'src/app/store/selectors/room.selector';

@Component({
  selector: 'app-archive',
  templateUrl: './archive.page.html',
  styleUrls: ['./archive.page.scss'],
})
export class ArchivePage implements OnInit {
  subscription: Subscription;
  currentUser$: Observable<User | null>;
  isLoading$: Observable<boolean>;
  rooms$: Observable<Room[] | null>;
  total$: Observable<number | null> = null;
  filteredRooms$: Observable<Room[] | null> = null;

  currentUserId: string = null;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Archived Rooms',
    color: 'warning',
  };

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
    // Get all chat Rooms
    this.listRooms();
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
      this.store.pipe(select(unArchiveRoomErrorSelector)).subscribe((error) => {
        if (error) {
          this.presentToast(error.message, 'danger');
          this.store.dispatch(unArchiveRoomInitialStateAction());
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

    this.filteredRooms$ = combineLatest([this.rooms$, this.currentUser$]).pipe(
      map(([rooms, currentUser]) => {
        if (!rooms) {
          return null;
        }
        return rooms.filter(
          (room) =>
            !currentUser.blockedUsers.includes(room?.['userData']?.$id) &&
            currentUser.archivedRooms.includes(room?.$id)
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
    this.store.dispatch(getRoomsAction());
  }

  getChat(room) {
    this.store.dispatch(activateRoomAction({ payload: room }));
  }

  handleRefresh(event) {
    this.listRooms();
    event.target.complete();
    console.log('Async operation refresh has ended');
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

  unArchiveRoom(room: Room) {
    console.log('unArchiveRoom', room);
    // Dispatch action
    const request = { roomId: room.$id };
    this.store.dispatch(unArchiveRoomAction({ request }));
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
