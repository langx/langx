import { Component, OnInit } from '@angular/core';
import { QueryFieldFilterConstraint } from '@angular/fire/firestore';
import { NavigationExtras, Router } from '@angular/router';
import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { FilterService, isFilter } from 'src/app/services/filter/filter.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  filterSubscription: any;

  users = [];
  lastVisible: any;

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService,
    private apiService: ApiService,
    private filterService: FilterService,
  ) { }

  ngOnInit() {
    this.checkFilter();
  }

  //
  // Check Filter
  //

  checkFilter() {

    this.authService.getUserData().then((currentUserData) => {
      if(currentUserData?.isFilterData) {
        this.filterService.setEvent(currentUserData?.filterData);
      }
    }).catch((error) => {
      console.log('error: ', error);
    });

    this.filterSubscription = this.filterService.getEvent()
    .subscribe(
      (filterData: isFilter) => {
        this.doSomething(filterData);
      }
    );
  }

  doSomething(filterData: isFilter) {
    console.log('filter: ', filterData);

    let queryFn: QueryFieldFilterConstraint = null;

    if (!filterData) {
      this.getUsers();
      return;
    }

    if (filterData?.isFilterGender) {
      queryFn = this.apiService.whereQuery("gender", "==", filterData?.filterGender);
    }

    console.log('queryFn: ', queryFn);
    this.getUsers(queryFn);
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    this.getMoreUsers(event);
  }

  async getUsers(queryFn?) {
    if(queryFn) {

      const docSnap = await this.chatService.getUsersWithFilterArray(queryFn);
      this.users = docSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId);

      // Get the last visible document
      let l = docSnap.docs[docSnap.docs.length-1];
      this.lastVisible = l || null;

    } else {
      const docSnap = await this.chatService.getUsers();
      // console.log('docSnap: ', docSnap.docs);
      this.users = docSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId);

      // Get the last visible document
      let l = docSnap.docs[docSnap.docs.length-1];
      this.lastVisible = l || null;
    }

  }

  async getMoreUsers(infiniteScroll?) {

      console.log('lastVisible: ', this.lastVisible.get('name'));
      // Use the query for pagination
      const nextDocSnap = await this.chatService.getMoreUsers(this.lastVisible);
      this.users.push(...nextDocSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId));

      // Get the last visible document
      let l = nextDocSnap.docs[nextDocSnap.docs.length-1];
      this.lastVisible = l || null;

      // TODO: check double, go another page and back, test with filters
      // Because if i disable the infiniteScroll, it will not work anymore until i refresh the page
      infiniteScroll.target.complete();
      if (!this.lastVisible) {
        infiniteScroll.target.disabled = true;
      }
    
  }

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
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.users = [];
    this.getUsers();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

}