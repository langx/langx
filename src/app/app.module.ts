import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideStorage, getStorage } from '@angular/fire/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAreigjnx4DTOkcZ4pV4ZoMf44kYzIIHdg",
  authDomain: "firechat-3b654.firebaseapp.com",
  projectId: "firechat-3b654",
  storageBucket: "firechat-3b654.appspot.com",
  messagingSenderId: "273644625627",
  appId: "1:273644625627:web:e1ae7d00a3e70bd937f6fe"
};

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot({
    //mode: 'md'
  }), AppRoutingModule,
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage())
],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
