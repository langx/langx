import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { ID } from 'appwrite';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  constructor(private api: ApiService) {}

  getTeams() {
    return this.api.teams.list();
  }

  getTeam(teamId: string) {
    return this.api.teams.get(teamId);
  }

  createTeam(name: string) {
    return this.api.teams.create(ID.unique(), name);
  }

  updateMembership(teamId: string, user: string) {
    return this.api.teams.updateMembership(teamId, user, []);
  }
}
