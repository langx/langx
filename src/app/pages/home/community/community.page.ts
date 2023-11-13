import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

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
    private filterService: FilterService,
    private storageService: StorageService,
    private toastController: ToastController,
    private loadingCtrl: LoadingController
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

  //
  // Get Users
  //

  async listUsers() {
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

        // List Users
        this.listUsers();
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
  }

  //
  // Get or Create Room
  //

  getRoom(userId: string) {
    this.currentUser$
      .subscribe((user) => {
        const currentUserId = user.$id;
        this.store.dispatch(getRoomAction({ currentUserId, userId }));
      })
      .unsubscribe();
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listUsers();
    if (event) event.target.complete();
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
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
