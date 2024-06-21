import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, combineLatest, map } from 'rxjs';

import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Import Actions and Selectors
import { activateRoomAction } from 'src/app/store/actions/message.action';
import {
  unArchiveRoomAction,
  unArchiveRoomInitialStateAction,
} from 'src/app/store/actions/room.action';
import {
  getArchivedRoomsAction,
  getArchivedRoomsWithOffsetAction,
} from 'src/app/store/actions/rooms.action';
import {
  currentUserSelector,
  unArchiveRoomErrorSelector,
} from 'src/app/store/selectors/auth.selector';
import {
  archivedRoomsSelector,
  archivedTotalSelector,
  errorSelector,
  isLoadingSelector,
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
  archivedRooms$: Observable<Room[] | null>;
  archivedTotal$: Observable<number | null> = null;
  filteredRooms$: Observable<Room[] | null> = null;

  currentUserId: string = null;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Archived Rooms',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController
  ) {}

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

    // Router Event Listener
    this.subscription.add(
      this.router.events.subscribe((event) => {
        if (
          event instanceof NavigationEnd &&
          event.url === '/home/messages/archive'
        ) {
          this.listRooms();
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
    this.archivedRooms$ = this.store.pipe(select(archivedRoomsSelector));
    this.archivedTotal$ = this.store.pipe(select(archivedTotalSelector));

    this.filteredRooms$ = combineLatest([
      this.archivedRooms$,
      this.currentUser$,
    ]).pipe(
      map(([archivedRooms, currentUser]) => {
        if (!archivedRooms) {
          return null;
        }
        return archivedRooms.filter(
          (room) =>
            !currentUser.blockedUsers.includes(room?.['userData']?.$id) &&
            currentUser.archivedRooms.includes(room.$id)
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
    this.store.dispatch(getArchivedRoomsAction());
  }

  getChat(room) {
    this.store.dispatch(activateRoomAction({ payload: room }));
  }

  handleRefresh(event) {
    this.listRooms();
    event.target.complete();
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    let offset: number = 0;

    this.archivedRooms$
      .subscribe((users) => {
        if (!users) return;
        offset = users.length;
        this.archivedTotal$
          .subscribe((total) => {
            if (offset < total) {
              this.store.dispatch(
                getArchivedRoomsWithOffsetAction({
                  request: { offset },
                })
              );
            } else {
              console.log('All archived rooms loaded');
            }
          })
          .unsubscribe();
      })
      .unsubscribe();

    event.target.complete();
  }

  unArchiveRoom(room: Room) {
    // Dispatch action
    const request = { room: room };
    this.store.dispatch(unArchiveRoomAction({ request }));
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
