import { Component, OnInit} from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';
import { PresenceService } from 'src/app/services/presence/presence.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(
    private auth: AuthService,
    private presence: PresenceService,
  ) {}

  async ngOnInit() {
    this.updatePresence();
  }

  updatePresence() {
    let id = this.auth.getId();
    this.presence.updatePresence(id);
  }
}