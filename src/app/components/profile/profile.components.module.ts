import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

// Profile Components
import { PpCardComponent } from 'src/app/components/profile/pp-card/pp-card.component';
import { OtherPhotosCardComponent } from 'src/app/components/profile/other-photos-card/other-photos-card.component';
import { AboutmeCardComponent } from 'src/app/components/profile/aboutme-card/aboutme-card.component';
import { LanguagesCardComponent } from 'src/app/components/profile/languages-card/languages-card.component';
import { BadgesCardComponent } from './badges-card/badges-card.component';
import { StreakCardComponent } from './streak-card/streak-card.component';

// Pipes
import { AppExtrasModule } from 'src/app/app.extras.module';

@NgModule({
  declarations: [
    PpCardComponent,
    AboutmeCardComponent,
    LanguagesCardComponent,
    BadgesCardComponent,
    StreakCardComponent,
  ],
  // declarations: [PpCardComponent, OtherPhotosCardComponent],
  imports: [CommonModule, IonicModule, AppExtrasModule],
  exports: [
    PpCardComponent,
    AboutmeCardComponent,
    LanguagesCardComponent,
    BadgesCardComponent,
    StreakCardComponent,
  ],
  // exports: [PpCardComponent, OtherPhotosCardComponent],
})
export class ProfileComponentsModule {}
