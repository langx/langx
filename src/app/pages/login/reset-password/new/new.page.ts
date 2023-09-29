import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {
  id: string;
  secret: string;
  expire: Date;
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValidation();
  }

  initValidation() {
    const id = this.route.snapshot.queryParamMap.get('userId');
    const secret = this.route.snapshot.queryParamMap.get('secret');
    const expire = this.route.snapshot.queryParamMap.get('expire');
    if (!id || !secret || !expire) {
      this.presentToast('Invalid URL', 'danger');
      this.router.navigateByUrl('/login');
      return;
    } else {
      this.id = id;
      this.secret = secret;
      this.expire = new Date(expire);
    }
    console.log(this.id, this.secret, this.expire);
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
