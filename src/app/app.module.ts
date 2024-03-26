import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { EffectsModule } from '@ngrx/effects';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireMessagingModule } from '@angular/fire/compat/messaging';
import { ServiceWorkerModule } from '@angular/service-worker';

import { AppComponent } from 'src/app/app.component';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { environment } from 'src/environments/environment';
import { localeReducers } from 'src/app/store/reducers/locale.reducer';
import { authReducers } from 'src/app/store/reducers/auth.reducer';
import { LocaleEffects } from './store/effects/locale.effect';
import { AuthEffect } from 'src/app/store/effects/auth.effect';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    IonicModule.forRoot(),
    StoreModule.forRoot({}),
    // TODO: Delete next line after version 1.0, not to have devtools in production
    StoreDevtoolsModule.instrument({
      maxAge: 250,
      logOnly: environment.production,
    }),
    EffectsModule.forRoot([]),
    StoreModule.forFeature('auth', authReducers),
    StoreModule.forFeature('locale', localeReducers),
    EffectsModule.forFeature([LocaleEffects, AuthEffect]),
    AngularFireModule.initializeApp(environment.firebaseConfig),
    AngularFireMessagingModule,
    ServiceWorkerModule.register('combined-sw.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 5 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:5000',
    }),
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
