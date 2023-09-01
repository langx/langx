import { Component, OnInit } from '@angular/core';
import { QueryFieldFilterConstraint } from '@angular/fire/firestore';
import { NavigationExtras, Router } from '@angular/router';
import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { FilterService, FilterData } from 'src/app/services/filter/filter.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  filterSubscription: any;
  filterData: FilterData;

  users = [];

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService,
    private apiService: ApiService,
    private userService: UserService,
    private filterService: FilterService,
    private storageService: StorageService
  ) { }

  async ngOnInit() {
    await this.checkFilter();
  }

  ngOnDestroy() {
    this.filterSubscription.unsubscribe();
    console.log('unsubscribed');
  }

  //
  // Check Filter
  //

  async checkFilter() {
    // Getting the filter data from DB
    /*
    this.authService.getUserData().then((currentUserData) => {
      if(currentUserData?.isFilterData) {
        this.filterService.setEvent(currentUserData?.filterData);
      }
    }).catch((error) => {
      console.log('error: ', error);
    });
    */

    await this.checkLocalStorage();

    this.filterSubscription = this.filterService.getEvent()
    .subscribe(
      (filterData: FilterData) => {
        this.filterData = filterData;
        console.log('Subscribed filter: ', filterData);
        console.log('Global filter: ', this.filterData);
        this.users = [];
        this.userService.refreshUsers();
        this.getUsers(filterData);
      }
    );
  }

  async checkLocalStorage() {
    // TODO: Getting the filter data from localStorage
    const languagesString = await this.storageService.get("languages") ;
    const gender = await this.storageService.get("gender") || null;
    const country = await this.storageService.get("country") || null;
    const minAgeString = await this.storageService.get("minAge");
    const maxAgeString = await this.storageService.get("maxAge");
    
    let minAge = Number(minAgeString) || null;
    let maxAge = Number(maxAgeString) || null;

    let languages : Array<any> = [];
    if(languagesString) {
      languages = languagesString.toLocaleString().split(",");
    }

    let filterData: FilterData = {
      languages: languages,
      gender: gender,
      country: country,
      minAge: minAge,
      maxAge: maxAge
    }

    console.log('checkLocalStorage', filterData);

    this.filterService.setEvent(filterData);
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    this.getUsers(this.filterData);
    event.target.complete();
    console.log('Async operation loadMore has ended');
  }

  async getUsers(filterData?: FilterData) {
    let users = await this.userService.getUsers(filterData);
    this.users.push(...users);
  }

  async getUsersWithFilters() {
    console.log('getUsersWithFilters');
    //this.users = await this.userService.getUsersWithFilters(this.filterData);
  }

  // async getMoreUsers(infiniteScroll, queryFn?) {

  //   if(queryFn) {
  //     console.log('lastVisible: ', this.lastVisible.get('name'));
  //     // Use the query for pagination
  //     const nextDocSnap = await this.chatService.getMoreUsersWithFilter(this.lastVisible, queryFn);
  //     this.users.push(...nextDocSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId));

  //     // Get the last visible document
  //     let l = nextDocSnap.docs[nextDocSnap.docs.length-1];
  //     this.lastVisible = l || null;

  //     // TODO: check double, go another page and back, test with filters
  //     // Because if i disable the infiniteScroll, it will not work anymore until i refresh the page
  //     infiniteScroll.target.complete();
  //     if (!this.lastVisible) {
  //       infiniteScroll.target.disabled = true;
  //     }
  //   } else {
  //     console.log('lastVisible: ', this.lastVisible.get('name'));
  //     // Use the query for pagination
  //     const nextDocSnap = await this.chatService.getMoreUsers(this.lastVisible);
  //     this.users.push(...nextDocSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId));

  //     // Get the last visible document
  //     let l = nextDocSnap.docs[nextDocSnap.docs.length-1];
  //     this.lastVisible = l || null;

  //     // TODO: check double, go another page and back, test with filters
  //     // Because if i disable the infiniteScroll, it will not work anymore until i refresh the page
  //     infiniteScroll.target.complete();
  //     if (!this.lastVisible) {
  //       infiniteScroll.target.disabled = true;
  //     }
  //   }    
  // }

  //
  // Start Chat
  //

  async startChat(item) {
    try {
      // showLoader();
      this.isLoading = true;
      // create chatroom
      const room = await this.chatService.createChatRoom(item?.uid);
      console.log('room: ', room);
      const navData: NavigationExtras = {
        queryParams: {
          name: item?.name,
          uid: item?.uid,
        }
      };
      this.router.navigate(['/', 'home', 'chat', room?.id], navData);
      // hideLoader();
      this.isLoading = false;
    } catch(e) {
      console.log(e);
      // hideLoader();
      this.isLoading = false;
    }
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.users = [];
    this.userService.refreshUsers();
    this.getUsers(this.filterData);
    event.target.complete();
    console.log('Async operation handleRefresh has ended');
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }

}