import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { lastSeen } from 'src/app/extras/utils';
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FcmService } from 'src/app/services/fcm/fcm.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getRoomsAction,
  getRoomsWithOffsetAction,
} from 'src/app/store/actions/room.action';
import {
  errorSelector,
  isLoadingSelector,
  roomsSelector,
  totalSelector,
} from 'src/app/store/selectors/room.selector';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
})
export class MessagesPage implements OnInit {
  currentUser$: Observable<User | null>;
  isLoading$: Observable<boolean>;
  rooms$: Observable<Room[] | null>;
  total$: Observable<number | null> = null;

  isLoadingCtrlActive: boolean = false;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private router: Router,
    private fcmService: FcmService,
    private loadingCtrl: LoadingController,
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

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.rooms$ = this.store.pipe(select(roomsSelector));
    this.total$ = this.store.pipe(select(totalSelector));

    // Loading Controller
    this.isLoading$.subscribe((isLoading) => {
      if (this.isLoadingCtrlActive === isLoading) return;
      else this.isLoadingCtrlActive = isLoading;
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
                  console.log('All users loaded');
                }
              })
              .unsubscribe();
          })
          .unsubscribe();
      })
      .unsubscribe();

    // this.getUsers(this.filterData);
    event.target.complete();
    console.log('Async operation loadMore has ended');
  }

  getChat(room) {
    this.router.navigate(['/', 'home', 'chat', room.$id]);
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

  //
  // Utils
  //

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'just now';
    return time;
  }

  //
  // Loading Controller
  //

  async loadingController(isShow: boolean) {
    if (isShow) {
      await this.loadingCtrl
        .create({
          message: 'Please wait...',
        })
        .then((loadingEl) => {
          loadingEl.present();
        });
    } else {
      this.loadingCtrl.dismiss();
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
