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

  // TODO: There is an error when creating a membership
  // You cannot create a membership for a team you are not a member of
  createMembership(teamId: string, userId: string) {
    return this.api.teams.createMembership(teamId, ['owner'], undefined, userId);
  }
}
