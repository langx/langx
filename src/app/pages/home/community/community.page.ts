import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { Firestore, collection, query, orderBy, startAfter, limit, getDocs, where } from '@angular/fire/firestore';
import { ChatService } from 'src/app/services/chat/chat.service';
import { AuthService } from 'src/app/services/auth/auth.service';

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
    private authService: AuthService,
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
    console.log('Done');
  }

  async loadUsers(infiniteScroll?) {
    if (!infiniteScroll) {
      // Query the first page of docs
      const first = query(this.collectionRef("users"),
      orderBy("lastSeen", "desc"), 
      limit(5));
      const documentSnapshots = await getDocs(first);
      this.users = documentSnapshots.docs.map(doc => doc.data());

      // Get the last visible document
      this.lastVisible = documentSnapshots.docs[documentSnapshots.docs.length-1];
      if (documentSnapshots.docs.length < 5) {
        infiniteScroll.target.disabled = true;
      }
    } else {
      const next = query(this.collectionRef("users"),
          orderBy("lastSeen", "desc"),
          startAfter(this.lastVisible),
          limit(5));
      // Use the query for pagination
      const nextDocumentSnapshots = await getDocs(next);
      this.users.push(...nextDocumentSnapshots.docs.map(doc => doc.data()));

      // Get the last visible document
      const l = nextDocumentSnapshots.docs[nextDocumentSnapshots.docs.length-1];
      this.lastVisible = l;
      if (nextDocumentSnapshots.docs.length < 5) {
        infiniteScroll.target.disabled = true;
      }
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