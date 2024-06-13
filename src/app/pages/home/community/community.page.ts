import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonSearchbar, ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

// Interface Imports
import { User } from 'src/app/models/User';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Service Imports
import { StorageService } from 'src/app/services/storage/storage.service';

// Action Imports
import { createRoomInitialStateAction } from 'src/app/store/actions/room.action';
import { getVisitsAction } from 'src/app/store/actions/visits.action';
import {
  getUsersByCompletedProfileAction,
  getUsersByCreatedAtAction,
  getUsersByLastSeenAction,
  getUsersByTargetLanguageAction,
} from 'src/app/store/actions/users.action';
import { setFiltersAction } from 'src/app/store/actions/filters.action';
import { clearErrorsAction } from 'src/app/store/actions/user.action';

// Selector Imports
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { createRoomErrorSelector } from 'src/app/store/selectors/room.selector';
import { filterDataSelector } from 'src/app/store/selectors/filters.selector';
import {
  usersByLastSeenSelector,
  errorSelector,
  usersByCreatedAtSelector,
  usersByTargetLanguageSelector,
  usersByCompletedProfileSelector,
} from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {
  @ViewChild('searchbar', { static: false }) searchbar: IonSearchbar;

  subscription: Subscription;

  segment: string = 'usersByTargetLanguage';

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

  searchActive: boolean = false;

  constructor(
    private store: Store,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private storageService: StorageService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    // Init values
    this.initValues();

    // Check Local Storage for filters
    await this.checkLocalStorage();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Filters
    this.subscription.add(
      this.store.pipe(select(filterDataSelector)).subscribe((filtersData) => {
        // console.log('filterDataSelector', filtersData);
        this.filterData = filtersData;

        // List Users
        this.listAllUsers();
      })
    );

    // User Errors
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

  initValues(): void {
    // Set values from selectors
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.usersByTargetLanguage$ = this.store.pipe(
      select(usersByTargetLanguageSelector)
    );
    this.usersByCompletedProfile$ = this.store.pipe(
      select(usersByCompletedProfileSelector)
    );
    this.usersByLastSeen$ = this.store.pipe(select(usersByLastSeenSelector));
    this.usersByCreatedAt$ = this.store.pipe(select(usersByCreatedAtSelector));
  }

  //
  // Segments
  //

  segmentChanged(event: any) {
    this.segment = event.detail.value;
    this.cdr.detectChanges();
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
  // Search
  //

  async toggleSearch(event: Event) {
    event.stopPropagation();
    this.searchActive = !this.searchActive;

    if (this.searchActive) {
      await this.searchbar.setFocus();
    }
  }

  handleContentClick() {
    if (this.searchActive) {
      this.searchActive = false;
    }
  }

  filterItems(event: any) {
    if (event.detail.value) {
      const searchTerm = event.detail.value;
      this.filterData = {
        ...this.filterData,
        search: searchTerm,
      };
      this.listAllUsers();
    }
  }

  //
  // Check Filter
  //

  async checkLocalStorage() {
    // Check localStorage
    const filterDataString = await this.storageService.getValue('filterData');

    if (filterDataString) {
      // Parse the JSON string back into an object
      const filterData = JSON.parse(filterDataString);

      // Use object destructuring to extract properties
      const {
        motherLanguages = [],
        studyLanguages = [],
        gender = null,
        onlyMyGender = false,
        country = null,
        minAge = null,
        maxAge = null,
      } = filterData;

      this.filterData = {
        motherLanguages,
        studyLanguages,
        gender,
        onlyMyGender,
        country,
        minAge: Number(minAge),
        maxAge: Number(maxAge),
      };

      this.store.dispatch(setFiltersAction({ payload: this.filterData }));
    } else {
      // Set default values
      this.filterData = {
        motherLanguages: [],
        studyLanguages: [],
        gender: null,
        onlyMyGender: false,
        country: null,
        minAge: null,
        maxAge: null,
      };

      this.store.dispatch(setFiltersAction({ payload: this.filterData }));
    }
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
