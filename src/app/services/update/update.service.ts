import { Injectable } from '@angular/core';
import { NativeMarket } from '@capacitor-community/native-market';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { InAppBrowser } from '@capgo/inappbrowser';
import { AlertController } from '@ionic/angular';

import { environment } from 'src/environments/environment';

interface AppUpdate {
  latest: string;
  maintenance_enabled: boolean;
  maintenace_msg?: {
    title: string;
    message: string;
  };
  major_update_msg?: {
    title: string;
    message: string;
    button: string;
  };
  minor_update_msg?: {
    title: string;
    message: string;
    button: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  updateEndpoint = environment.api.UPDATE_API_URL;

  constructor(private AlertController: AlertController) {}

  checkForUpdates() {
    console.log('checkForUpdates');
    this.checkUpdate();
  }

  // async checkMaintenance() {
  //   const response = await fetch(this.maintenanceEndpoint);
  //   const data = await response.json();
  //   if (data.enabled) {
  //     this.showMaintenance(data.msg_maintenace);
  //   }
  // }

  async checkUpdate() {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      console.log('checkUpdate', 'web');
      return;
    } else if (platform === 'android') {
      console.log('checkUpdate', 'android');
      await this.checkPlatformUpdate('/android');
    } else if (platform === 'ios') {
      console.log('checkUpdate', 'ios');
      await this.checkPlatformUpdate('/ios');
    } else {
      return;
    }
  }

  async checkPlatformUpdate(platformPath: string) {
    let endpoint = this.updateEndpoint + platformPath;
    const response = await fetch(endpoint);
    const data = (await response.json()) as AppUpdate;
    console.log('checkUpdate', data);
    if (data.maintenance_enabled) {
      this.showMaintenance(data);
    }
  }

  async showMaintenance(data: AppUpdate) {
    console.log('showMaintenance', data);
    const alert = await this.AlertController.create({
      header: data.maintenace_msg.title,
      message: data.maintenace_msg.message,
      backdropDismiss: false, // prevent alert from being dismissed
    });
    await alert.present();
  }

  async showUpdate(data: AppUpdate) {
    console.log('showUpdate', data);
    // const alert = await this.AlertController.create({
    //   header: data.msg_major_update.title,
    //   message: data.msg_major_update.message,
    //   buttons: [
    //     {
    //       text: data.msg_major_update.button,
    //       handler: () => {
    //         this.openMarket();
    //       },
    //     },
    //   ],
    // });
    // await alert.present();
  }

  async openMarket() {
    console.log('Open market');
    // if (Capacitor.getPlatform() === 'web') {
    //   window.open('https://play.google.com/store/apps/details?id=com.example.app');
    // } else {
    //   const market = new NativeMarket();
    //   market.open();
    // }
  }
}
