import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { RoomService } from 'src/app/services/chat/room.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import { User } from 'src/app/models/User';
import { FilterService } from 'src/app/services/filter/filter.service';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getRoomAction,
  getUsersAction,
  getUsersWithOffsetAction,
} from 'src/app/store/actions/community.action';
import {
  isLoadingSelector,
  usersSelector,
  totalSelector,
  errorSelector,
} from 'src/app/store/selectors/community.selector';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {
  filter$: any;
  filterData: FilterDataInterface;

  currentUser$: Observable<User>;
  isLoading$: Observable<boolean>;
  users$: Observable<User[] | null> = null;
  total$: Observable<number | null> = null;

  constructor(
    private store: Store,
    private router: Router,
    private roomService: RoomService,
    private filterService: FilterService,
    private storageService: StorageService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.checkLocalStorage();
    await this.checkFilter();
    this.initValues();
  }

  ngOnDestroy() {
    this.filter$.unsubscribe();
    console.log('filters unsubscribed');
  }

  initValues(): void {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.users$ = this.store.pipe(select(usersSelector));
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

  //
  // Get Users
  //

  async getUsers() {
    const filterData = this.filterData;
    this.store.dispatch(getUsersAction({ filterData }));
  }

  //
  // Check Filter
  //

  async checkFilter() {
    this.filter$ = this.filterService
      .getEvent()
      .subscribe((filterData: FilterDataInterface) => {
        this.filterData = filterData;
        console.log('Subscribed filter: ', filterData);
        // Handle Refresh fetch users by using filterData in getUsers()
        this.handleRefresh(null);
      });
  }

  // TODO: #246 Save filterData with JSON.stringify();
  async checkLocalStorage() {
    // Getting the filter data from Capacitor Preferences
    let languagesString =
      (await this.storageService.getValue('languages')) || [];
    const gender = (await this.storageService.getValue('gender')) || null;
    const country = (await this.storageService.getValue('country')) || null;
    const minAgeString = (await this.storageService.getValue('minAge')) || null;
    const maxAgeString = (await this.storageService.getValue('maxAge')) || null;

    let minAge = Number(minAgeString) || null;
    let maxAge = Number(maxAgeString) || null;

    // TODO: Do better logic here
    let languages: Array<any> = [];
    if (languagesString) {
      languages = languagesString.toLocaleString().split(',');
      if (languages.length === 1 && languages[0] === '') {
        languages = [];
      }
    }

    let filterData: FilterDataInterface = {
      languages: languages,
      gender: gender,
      country: country,
      minAge: minAge,
      maxAge: maxAge,
    };

    console.log('checkLocalStorage', filterData);
    this.filterService.setEvent(filterData);
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    let offset: number = 0;
    this.users$
      .subscribe((users) => {
        offset = users.length;
        this.total$
          .subscribe((total) => {
            if (offset < total) {
              this.store.dispatch(
                getUsersWithOffsetAction({
                  filterData: this.filterData,
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

    // this.getUsers(this.filterData);
    event.target.complete();
    console.log('Async operation loadMore has ended');
  }

  //
  // Get or Create Room
  //

  getRoom(userId: string) {
    this.currentUser$.subscribe((user) => {
      const currentUserId = user.$id;
      this.store.dispatch(getRoomAction({ currentUserId, userId }));
    });
  }

  /*
  async startChat(user: any) {
    let roomId: string;

    await this.roomService.checkRoom(user.$id).then(
      (response) => {
        roomId = response?.$id;
        console.log(response); // Success

        this.router.navigate(['/', 'home', 'chat', roomId]);
      },
      (error) => {
        console.log('error: ', error.message); // Failure
        this.presentToast('Error: ' + error.message, 'danger');
      }
    );
  }
  */

  //
  // Pull to refresh
  //

  handleRefresh(event?) {
    this.getUsers();
    if (event) event.target.complete();
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
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
