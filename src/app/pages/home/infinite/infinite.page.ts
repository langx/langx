import { Component, OnInit } from '@angular/core';
import { Firestore, collection, query, orderBy, startAfter, limit, getDocs } from '@angular/fire/firestore';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-infinite',
  templateUrl: './infinite.page.html',
  styleUrls: ['./infinite.page.scss'],
})
export class InfinitePage implements OnInit {

  users = [];
  lastVisible: any;

  constructor(
    public navCtrl: NavController,
    private firestore: Firestore
  ) { }

  ngOnInit() {
    this.loadUsers();
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

  loadMore(infiniteScroll) {
    this.loadUsers(infiniteScroll);
  }

  collectionRef(path) {
    return collection(this.firestore, path);
  }
  
}