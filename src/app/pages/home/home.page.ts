import { Component, OnInit} from '@angular/core';
import { firebaseApp$ } from '@angular/fire/app';
import { Database, getDatabase, onValue, ref, set } from '@angular/fire/database';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.updatePresence();
  }

  updatePresence() {
    let id = this.auth.getId();
    this.auth.updatePresence(id);
  }
}