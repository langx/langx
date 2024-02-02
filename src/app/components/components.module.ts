import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { EmptyScreenComponent } from 'src/app/components/empty-screen/empty-screen.component';
import { Oauth2Component } from 'src/app/components/oauth2/oauth2.component';
import { RedirectComponent } from 'src/app/components/redirect/redirect.component';
import { SpinnerComponent } from './spinner/spinner.component';
import { RoomListComponent } from './room-list/room-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { BlockedUserListComponent } from './blocked-user-list/blocked-user-list.component';
import { VisitListComponent } from './visit-list/visit-list.component';
import { UserBoxComponent } from './user-box/user-box.component';

@NgModule({
  declarations: [
    EmptyScreenComponent,
    Oauth2Component,
    RedirectComponent,
    SpinnerComponent,
    RoomListComponent,
    UserListComponent,
    UserBoxComponent,
    VisitListComponent,
    BlockedUserListComponent,
  ],
  imports: [CommonModule, IonicModule],
  exports: [
    EmptyScreenComponent,
    Oauth2Component,
    RedirectComponent,
    SpinnerComponent,
    RoomListComponent,
    UserListComponent,
    UserBoxComponent,
    VisitListComponent,
    BlockedUserListComponent,
  ],
})
export class ComponentsModule {}
