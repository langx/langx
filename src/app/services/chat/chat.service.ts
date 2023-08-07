import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  currentUserId: string;
  public users: Observable<any>;

  constructor(
    public auth: AuthService,
    public api: ApiService
  ) { 
    this.getId();
  }

  getId() {
    this.currentUserId = this.auth.getId()
  }

  getUsers() {
    this.users = this.api.collectionDataQuery(
      'users',
      this.api.whereQuery('uid', '!=', this.currentUserId)
    )
  }
}