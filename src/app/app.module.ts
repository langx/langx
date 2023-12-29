import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { EffectsModule } from '@ngrx/effects';

import { AppComponent } from 'src/app/app.component';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { environment } from 'src/environments/environment';
import { localeReducers } from 'src/app/store/reducers/locale.reducer';
import { authReducers } from 'src/app/store/reducers/auth.reducer';
import { LocaleEffects } from './store/effects/locale.effect';
import { AuthEffect } from 'src/app/store/effects/auth.effect';
import { AppInitService } from 'src/app/services/appInit/app-init.service';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    IonicModule.forRoot(),
    StoreModule.forRoot({}),
    StoreDevtoolsModule.instrument({
      maxAge: 250,
      logOnly: environment.production,
    }),
    EffectsModule.forRoot([]),
    StoreModule.forFeature('auth', authReducers),
    StoreModule.forFeature('locale', localeReducers),
    EffectsModule.forFeature([LocaleEffects, AuthEffect]),
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (appInitializer: AppInitService) => () =>
        appInitializer.init(),
      deps: [AppInitService],
      multi: true,
    },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
