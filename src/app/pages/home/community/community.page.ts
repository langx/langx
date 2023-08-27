import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Firestore, collection, query, orderBy, startAfter, limit, getDocs, where } from '@angular/fire/firestore';
import { ChatService } from 'src/app/services/chat/chat.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  users = [];
  lastVisible: any;

  isLoading: boolean = false;
  open_new_chat:boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private firestore: Firestore
  ) { }

  ngOnInit() {
    this.getUsers(); // get all Community Users
  }

  getUsers() {
    //TODO: showLoader();
    this.isLoading = true;
    this.loadUsers();
    //TODO: hideLoader();
    this.isLoading = false;
  }

  //
  //Infinite Scroll
  //

  loadMore(event) {
    this.loadUsers(event);
  }

  async loadUsers(infiniteScroll?) {
    if (!infiniteScroll) {
      const docSnap = await this.chatService.getUsers();
      this.users = docSnap.docs.map(doc => doc.data());

      // Get the last visible document
      let l = docSnap.docs[docSnap.docs.length-1];
      this.lastVisible = l || null;

    } else {
      // Use the query for pagination
      const nextDocSnap = await this.chatService.getMoreUsers(this.lastVisible);
      this.users.push(...nextDocSnap.docs.map(doc => doc.data()));

      // Get the last visible document
      let l = nextDocSnap.docs[nextDocSnap.docs.length-1];
      this.lastVisible = l || null;
      infiniteScroll.target.complete();
    }

  }

  collectionRef(path) {
    return collection(this.firestore, path);
  }


  async startChat(item) {
    try {
      // showLoader();
      this.isLoading = true;
      // create chatroom
      const room = await this.chatService.createChatRoom(item?.uid);
      console.log('room: ', room);
      this.cancel();
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

  cancel(){
    this.open_new_chat = false;
  }

  getFiltersPage() {
    this.router.navigateByUrl('/home/community/filters');
  }

  handleRefresh(event) {
    this.getUsers();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

}