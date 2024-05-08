import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

// Interface Imports
import { User } from 'src/app/models/User';
import { Visit } from 'src/app/models/Visit';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Service Imports
import { StorageService } from 'src/app/services/storage/storage.service';
import { FilterService } from 'src/app/services/filter/filter.service';

// Action Imports
import { createRoomInitialStateAction } from 'src/app/store/actions/room.action';
import { getVisitsAction } from 'src/app/store/actions/visits.action';
import {
  getUsersByCompletedProfileAction,
  getUsersByCreatedAtAction,
  getUsersByLastSeenAction,
  getUsersByTargetLanguageAction,
} from 'src/app/store/actions/users.action';

// Selector Imports
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { createRoomErrorSelector } from 'src/app/store/selectors/room.selector';
import {
  isLoadingByTargetLanguageSelector,
  isLoadingByLastSeenSelector,
  isLoadingByCreatedAtSelector,
  usersByLastSeenSelector,
  errorSelector,
  usersByCreatedAtSelector,
  usersByTargetLanguageSelector,
  isLoadingByCompletedProfileSelector,
  usersByCompletedProfileSelector,
} from 'src/app/store/selectors/user.selector';
import {
  isLoadingSelector,
  totalSelector,
  visitsSelector,
} from 'src/app/store/selectors/visits.selector';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {
  subscription: Subscription;

  segment: string = 'usersByTargetLanguage';

  filter$: any;
  filterData: FilterDataInterface;

  currentUser$: Observable<User>;

  isLoadingByTargetLanguage$: Observable<boolean>;
  isLoadingByCompletedProfile$: Observable<boolean>;
  isLoadingByLastSeen$: Observable<boolean>;
  isLoadingByCreatedAt$: Observable<boolean>;
  usersByTargetLanguage$: Observable<User[] | null> = null;
  usersByCompletedProfile$: Observable<User[] | null> = null;
  usersByLastSeen$: Observable<User[] | null> = null;
  usersByCreatedAt$: Observable<User[] | null> = null;

  // Visits
  isLoadingVisits$: Observable<boolean>;
  visits$: Observable<Visit[] | null> = null;
  totalVisits$: Observable<number | null> = null;
  model = {
    icon: 'people-outline',
    title: 'No Profile Visitors Yet',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private router: Router,
    private filterService: FilterService,
    private storageService: StorageService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    // Init values
    this.initValues();

    // Check Local Storage for filters
    await this.checkLocalStorage();
    await this.checkFilter();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // User Errors
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
      this.store
        .pipe(select(createRoomErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            // Clear the error state
            this.store.dispatch(createRoomInitialStateAction());
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  ngOnDestroy() {
    this.filter$.unsubscribe();
    // console.log('filters unsubscribed');
  }

  initValues(): void {
    // Set values from selectors
    this.currentUser$ = this.store.pipe(select(currentUserSelector));

    this.isLoadingByTargetLanguage$ = this.store.pipe(
      select(isLoadingByTargetLanguageSelector)
    );
    this.isLoadingByCompletedProfile$ = this.store.pipe(
      select(isLoadingByCompletedProfileSelector)
    );
    this.isLoadingByLastSeen$ = this.store.pipe(
      select(isLoadingByLastSeenSelector)
    );
    this.isLoadingByCreatedAt$ = this.store.pipe(
      select(isLoadingByCreatedAtSelector)
    );
    this.usersByTargetLanguage$ = this.store.pipe(
      select(usersByTargetLanguageSelector)
    );
    this.usersByCompletedProfile$ = this.store.pipe(
      select(usersByCompletedProfileSelector)
    );
    this.usersByLastSeen$ = this.store.pipe(select(usersByLastSeenSelector));
    this.usersByCreatedAt$ = this.store.pipe(select(usersByCreatedAtSelector));

    // Visits
    this.isLoadingVisits$ = this.store.pipe(select(isLoadingSelector));
    this.visits$ = this.store.pipe(select(visitsSelector));
    this.totalVisits$ = this.store.pipe(select(totalSelector));
  }

  //
  // Segments
  //

  segmentChanged(event: any) {
    console.log('Segment changed', event.detail.value);
    this.segment = event.detail.value;
  }

  //
  // Get Users
  //

  listUsersByTargetLanguage() {
    const filterData = this.filterData;
    this.store.dispatch(
      getUsersByTargetLanguageAction({ request: { filterData } })
    );
  }

  listUsersByCompletedProfile() {
    const filterData = this.filterData;
    this.store.dispatch(
      getUsersByCompletedProfileAction({ request: { filterData } })
    );
  }

  listUsersByLastSeen() {
    const filterData = this.filterData;
    this.store.dispatch(getUsersByLastSeenAction({ request: { filterData } }));
  }

  listUsersByCreatedAt() {
    const filterData = this.filterData;
    this.store.dispatch(getUsersByCreatedAtAction({ request: { filterData } }));
  }

  listVisits() {
    this.store.dispatch(getVisitsAction());
  }

  listAllUsers() {
    this.listUsersByTargetLanguage();
    this.listUsersByCompletedProfile();
    this.listUsersByLastSeen();
    this.listUsersByCreatedAt();
    this.listVisits();
  }

  //
  // Check Filter
  //

  async checkFilter() {
    this.filter$ = this.filterService
      .getEvent()
      .subscribe((filterData: FilterDataInterface) => {
        this.filterData = filterData;
        // console.log('Subscribed filter: ', filterData);

        // List Users
        this.listAllUsers();
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

    // console.log('checkLocalStorage', filterData);
    this.filterService.setEvent(filterData);
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    // List Users
    this.listAllUsers();
    if (event) event.target.complete();
  }

  //
  // Routes
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }

  getProfilePage(userId: string) {
    this.router.navigateByUrl('/home/user/' + userId);
  }

  getTargetLanguagePage() {
    this.router.navigateByUrl('/home/community/target-language');
  }

  getEnthusiastPage() {
    this.router.navigateByUrl('/home/community/enthusiast');
  }

  getOnlinePage() {
    this.router.navigateByUrl('/home/community/online');
  }

  getNewUsersPage() {
    this.router.navigateByUrl('/home/community/new');
  }

  getVisitsPage() {
    this.router.navigateByUrl('/home/visitors');
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
