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
    return this.api.teams.create(ID.unique(), name, ['owner']);
  }

  // TODO: There is an error when creating a membership
  // You cannot create a membership for a team you are not a member of
  // Error: AppwriteException: Permissions must be one of: (any, users, user:6512ed1d95e48c227190, user:6512ed1d95e48c227190/unverified, users/unverified)
  // Answer: Yes, you can use a team or an appwrite function
  // https://discord.com/channels/564160730845151244/1158556321801588860
  // Bug Report: Code 400, URL is required, but createMembership method its optional. #6839
  // https://github.com/appwrite/appwrite/issues/6839
  createMembership(teamId: string, userId: string) {
    return this.api.teams.createMembership(
      teamId,
      ['owner'],
      undefined,
      userId
    );
  }
}
