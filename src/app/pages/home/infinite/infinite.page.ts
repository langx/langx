import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Firestore, collection, query, orderBy, startAfter, limit, getDocs, doc } from '@angular/fire/firestore';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-infinite',
  templateUrl: './infinite.page.html',
  styleUrls: ['./infinite.page.scss'],
})
export class InfinitePage implements OnInit {

  users = [];
  page = 0;

  constructor(
    public navCtrl: NavController,
    private httpClient: HttpClient,
    private firestore: Firestore
  ) { }

  ngOnInit() {
    this.loadUsers();
    this.loadFromFirestore();
  }

  loadUsers(infiniteScroll?) {
    this.httpClient.get(`https://randomuser.me/api/?results=20&page=${this.page}`)
    .subscribe(res => {
      this.users = this.users.concat(res['results']);
      if (infiniteScroll) {
        infiniteScroll.target.complete();
      }
    })
  }

  loadMore(infiniteScroll) {
    console.log('Begin async operation', this.page)
    this.page++;
    this.loadUsers(infiniteScroll);
  }

  collectionRef(path) {
    return collection(this.firestore, path);
  }
  
  async loadFromFirestore() {
    // Query the first page of docs
    const first = query(this.collectionRef("users"), orderBy("lastSeen", 'desc'), limit(5));
    // TODO: Convert getDocs to collectionData
    const documentSnapshots = await getDocs(first);
    
    // Get the last visible document
    const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length-1];
    console.log("last", lastVisible.get("name"));
    
    // Construct a new query starting at this document,
    // get the next 25 cities.
    const next = query(this.collectionRef("users"),
        orderBy("lastSeen", 'desc'),
        startAfter(lastVisible),
        limit(5));
    // Use the query for pagination
    const nextDocumentSnapshots = await getDocs(next);
    const l = nextDocumentSnapshots.docs[nextDocumentSnapshots.docs.length-1];
    console.log("next", l.get("name"));
  }

}