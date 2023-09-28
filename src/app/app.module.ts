import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { environment } from 'src/environments/environment';

import {
  provideFirebaseApp,
  initializeApp,
  // getApp
} from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import {
  provideAuth,
  getAuth,
  // initializeAuth,
  // indexedDBLocalPersistence,
} from '@angular/fire/auth';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { IonicStorageModule } from '@ionic/storage-angular';
// import { Drivers } from '@ionic/storage';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicStorageModule.forRoot({
      // name: '__mydb',
      // driverOrder: [Drivers.LocalStorage, Drivers.IndexedDB]
    }),
    IonicModule.forRoot({
      // mode: 'md'
    }),
    AppRoutingModule,
    provideFirebaseApp(() => initializeApp(environment?.firebase)),
    provideAuth(() => getAuth()),
    /* FOR IOS ONLY
    provideAuth(() => {
      if (Capacitor.isNativePlatform()) {
        return initializeAuth(getApp(), {
          persistence: indexedDBLocalPersistence
        })
      } else {
        return getAuth()
      }
    }),
    */
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()),
    provideStorage(() => getStorage()),
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
