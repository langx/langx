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
import { StreakListComponent } from './streak-list/streak-list.component';
import { TimestampComponent } from './chat-box/timestamp/timestamp.component';

// Profile Components
import { PpCardComponent } from './profile/pp-card/pp-card.component';

// Pipes
import { AppExtrasModule } from '../app.extras.module';
import { OtherPhotosCardComponent } from './profile/other-photos-card/other-photos-card.component';

@NgModule({
  declarations: [
    EmptyScreenComponent,
    Oauth2Component,
    RedirectComponent,
    SpinnerComponent,
    RoomListComponent,
    UserListComponent,
    VisitListComponent,
    StreakListComponent,
    BlockedUserListComponent,
    TimestampComponent,
    PpCardComponent,
  ],
  imports: [CommonModule, IonicModule, AppExtrasModule],
  exports: [
    EmptyScreenComponent,
    Oauth2Component,
    RedirectComponent,
    SpinnerComponent,
    RoomListComponent,
    UserListComponent,
    VisitListComponent,
    StreakListComponent,
    BlockedUserListComponent,
    TimestampComponent,
    PpCardComponent,
  ],
})
export class ComponentsModule {}
