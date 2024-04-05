import { Injectable } from '@angular/core';
import { NativeMarket } from '@capacitor-community/native-market';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
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
  updateEndpoint = environment.api.UPDATE;

  constructor(private AlertController: AlertController) {}

  checkForUpdates() {
    // console.log('checkForUpdates');
    this.checkUpdate();
  }

  async checkUpdate() {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      // console.log('checkUpdate', 'web');
      await this.checkPlatformUpdate('/web');
      return;
    } else if (platform === 'android') {
      // console.log('checkUpdate', 'android');
      await this.checkPlatformUpdate('/android');
    } else if (platform === 'ios') {
      // console.log('checkUpdate', 'ios');
      await this.checkPlatformUpdate('/ios');
    } else {
      return;
    }
  }

  async checkPlatformUpdate(platformPath: string) {
    let endpoint = this.updateEndpoint + platformPath;
    const response = await fetch(endpoint);
    const data = (await response.json()) as AppUpdate;
    // console.log('checkUpdate', data);
    if (data.maintenance_enabled) {
      this.showMaintenance(data);
    } else {
      if (platformPath === '/web') return;

      const currentVersion = await App.getInfo();
      // console.log('currentVersion', currentVersion.version);
      // console.log('data.latest', data.latest);
      if (currentVersion.version !== data.latest) {
        // Check if it's a major update
        const currentVersionNumbers = currentVersion.version
          .split('.')
          .map(Number);
        const latestVersionNumbers = data.latest.split('.').map(Number);

        if (latestVersionNumbers[0] > currentVersionNumbers[0]) {
          // Handle major update
          this.showMajorUpdate(data);
        } else if (latestVersionNumbers[0] === currentVersionNumbers[0]) {
          if (latestVersionNumbers[1] > currentVersionNumbers[1]) {
            // Handle minor update
            this.showMajorUpdate(data);
          } else if (
            latestVersionNumbers[1] === currentVersionNumbers[1] &&
            latestVersionNumbers[2] > currentVersionNumbers[2]
          ) {
            // Handle patch update
            this.showMinorUpdate(data);
          }
        }
      }
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

  async showMajorUpdate(data: AppUpdate) {
    console.log('showUpdate', data);

    const alert = await this.AlertController.create({
      header: data.major_update_msg.title,
      message: data.major_update_msg.message,
      buttons: [
        {
          text: data.major_update_msg.button,
          handler: () => {
            this.openAppStore();
            this.checkForUpdates();
          },
        },
      ],
      backdropDismiss: false, // prevent alert from being dismissed
    });
    await alert.present();
  }

  async showMinorUpdate(data: AppUpdate) {
    console.log('showUpdate', data);

    const alert = await this.AlertController.create({
      header: data.minor_update_msg.title,
      message: data.minor_update_msg.message,
      buttons: [
        {
          text: data.minor_update_msg.button,
          handler: () => {
            this.openAppStore();
            this.checkForUpdates();
          },
        },
        {
          text: 'Later',
          role: 'cancel',
        },
      ],
    });
    await alert.present();
  }

  async openAppStore() {
    let appId: string;
    if (Capacitor.getPlatform() === 'android') {
      appId = environment.bundleId;
    } else if (Capacitor.getPlatform() === 'ios') {
      appId = environment.iosId;
    } else {
      return;
    }
    NativeMarket.openStoreListing({
      appId: appId,
    });
  }
}
