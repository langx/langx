import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { getAge, lastSeen } from 'src/app/extras/utils';
import { AuthService } from 'src/app/services/auth/auth.service';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
})
export class UserPage implements OnInit {

  userId: string;
  user: any;

  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private modalCtrl: ModalController
  ) { }

  async ngOnInit() {
    //TODO: this.userID may be used in nowhere
    const id: string = this.route.snapshot.paramMap.get('id');
    if(id) this.userId = id;
    this.getUserData();
  }

  async openPreview(photos) {
    console.log(photos);
    const modal = await this.modalCtrl.create({
      component: PreviewPhotoComponent,
      componentProps: {
        photos: photos
      }
    });
    modal.present(); 
  }

  async getUserData() {
    // getting user data from the database while using getUserData() method in auth.service.ts
    this.user = await this.authService.getUserDataById(this.userId);
    console.log('userData: ', this.user);
  }

  lastSeen(d: any) { 
    if (!d) return null;
    let a = new Date(d.seconds * 1000)
    return lastSeen(a);
   }

  getAge(d: any) {
    if (!d) return null;
    let a = new Date(d.seconds * 1000)
    return getAge(a);
  }

}