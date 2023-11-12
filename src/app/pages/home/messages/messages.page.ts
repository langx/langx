import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { BehaviorSubject, Observable } from 'rxjs';

import { lastSeen } from 'src/app/extras/utils';
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { AuthService } from 'src/app/services/auth/auth.service';
import { RoomService } from 'src/app/services/chat/room.service';
import { FcmService } from 'src/app/services/fcm/fcm.service';
import { getRoomsAction } from 'src/app/store/actions/room.action';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
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
  rooms: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  isLoading: boolean = false;

  currentUser$: Observable<User | null>;
  isLoading$: Observable<boolean>;
  rooms$: Observable<Room[] | null>;
  total$: Observable<number | null> = null;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No Chat Rooms',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private router: Router,
    private authService: AuthService,
    private roomService: RoomService,
    private fcmService: FcmService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.initValues();
    // Trigger FCM
    this.fcmService.registerPush();
    // Get all chat Rooms
    this.listRooms2();
    //await this.listRooms();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.rooms$ = this.store.pipe(select(roomsSelector));
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

  listRooms2() {
    this.currentUser$
      .subscribe((user) => {
        if (user) {
          const currentUserId = user.$id;
          this.store.dispatch(getRoomsAction({ currentUserId }));
        }
      })
      .unsubscribe();
  }

  async listRooms() {
    const cUserId = this.authService.getUserId();
    await this.roomService.listRooms(cUserId);
    this.rooms = this.roomService.rooms;
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

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'just now';
    return time;
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
