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
import { CheckoutListComponent } from './checkout-list/checkout-list.component';
import { WalletListComponent } from './wallet-list/wallet-list.component';

// Pipes
import { AppExtrasModule } from 'src/app/app.extras.module';

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
    WalletListComponent,
    CheckoutListComponent,
    BlockedUserListComponent,
    TimestampComponent,
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
    WalletListComponent,
    CheckoutListComponent,
    BlockedUserListComponent,
    TimestampComponent,
  ],
})
export class ComponentsModule {}
