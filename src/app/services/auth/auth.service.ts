import { Injectable } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword , signInWithPopup, GoogleAuthProvider} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public _uid = new BehaviorSubject<any>(null);
  public _cUser = new BehaviorSubject<any>(null);

  // TODO: not only aboutMe, but also other user data or all currentuserData
  currentUser: any;
  currentUserData: any;

  constructor(
    private fireAuth: Auth,
    private apiService: ApiService
  ) { }

  async login(email: string, password: string): Promise<any> {
    try {
      const response = await signInWithEmailAndPassword(
        this.fireAuth,
        email,
        password
      );
      console.log(response);
      if(response?.user) {
        this.setUserData(response.user.uid);
        await this.apiService.setDocument(`users/${response.user.uid}`, {lastLogin: new Date(), lastSeen: new Date()}, {merge: true});
        return response.user.uid;
      }
    } catch(e) {
      throw(e);
    }
  }

  getId() {
    const auth = getAuth();
    this.currentUser = auth.currentUser;
    // console.log('getId() in auth.service ', this.currentUser, this.currentUser.uid);
    return this.currentUser?.uid;
  }

  setUserData(uid) {
    this._uid.next(uid);
  }

  setCurrentUserData(cUser) {
    this._cUser.next(cUser);
  }

  randomIntFromInterval = (min: number,max: number) => { return Math.floor(Math.random() * (max-min+1) +min) }

  async register(formValue) {
    try {
      const registeredUser = await createUserWithEmailAndPassword(
        this.fireAuth,
        formValue?.email,
        formValue?.password
      );
      console.log('registredUser:', registeredUser);
      const data = {
        email: formValue?.email,
        name: formValue?.name,
        uid: registeredUser.user.uid,
        photo: 'https://i.pravatar.cc/' + this.randomIntFromInterval(200,400),
        lastLogin: new Date(),
        lastSeen: new Date(),
        online: true,
        emailVerified: false
      }
      await this.apiService.setDocument(`users/${registeredUser.user.uid}`, data);
      const userData = {
        id: registeredUser.user.uid
      };
      // set user data while registering
      this.setUserData(registeredUser.user.uid);
      this.setCurrentUserData(registeredUser);
      return userData;
    } catch(e) {
      throw(e);
    }
  }

  //TODO: If user first registered with email than GoogleAuthProvider will not work #36
  async signInWithGoogle() {
    try {
      const res = await signInWithPopup(this.fireAuth, new GoogleAuthProvider());
      const user = res.user;
      console.log('user:', user);
      const userData = await this.getUserData();
      if(userData) {
        console.log('user_data:', userData);
        this.setUserData(user.uid);
        await this.apiService.setDocument(`users/${userData.uid}`, {lastLogin: new Date(), lastSeen: new Date()}, {merge: true});
        return user.uid; 
      } else {
        //TODO: create user data
        const data = {
          email: user.email,
          name: user?.displayName,
          uid: user.uid,
          photo: user?.photoURL,
          phoneNumber: user?.phoneNumber,
          emailVerified: user?.emailVerified,
          lastLogin: new Date(),
          lastSeen: new Date(),
          online: true, 
          completeLanguages: false,
          completeProfile: false,
          googleVerified: true,
        }
        await this.apiService.setDocument(`users/${user.uid}`, data);
        const userData = {
          id: user.uid
        };
        // set user data while registering
        this.setUserData(user.uid);
        this.setCurrentUserData(user);
        return user.uid; 
      }
    } catch (error) {
      console.log('error:', error);
      throw(error); 
    }
  }

  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(this.fireAuth, email);
    } catch(e) {
      throw(e);
    }
  }

  async logout() {
    try {
      await this.fireAuth.signOut();
      this.setUserData(null);
      this.setCurrentUserData(null);
      this.currentUser = null;
      return true;
    } catch(e) {
      throw(e);
    }
  }

  checkAuth(): Promise<any> {
    return new Promise((resolve, reject) => {
      onAuthStateChanged(this.fireAuth, user => {
        // console.log('auth user:', user);
        resolve(user);
        return true;
      })
    })
  }

  async getUserData() {
    if (!this.currentUserData) {
      let uid = this.getId();
      const docSnap: any = await this.apiService.getDocById(`users/${uid}`);
      if(docSnap?.exists()) {
        this._cUser.next(docSnap.data());
        return docSnap.data();
      } else {
        return null;
      }
    } else {
      this._cUser.next(this.currentUserData);
      return Promise.resolve(this.currentUserData);
    }
  }

  async getUserDataById(uid: string) {
    const docSnap: any = await this.apiService.getDocById(`users/${uid}`);
    if(docSnap?.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  }
  
  async updateUserProfileData(formValue) {
    let id = this.getId();
    //console.log('id:', id, 'formValue:', formValue);
    try {
      const data = {
        birthdate: formValue?.birthdateWithDateFormat,
        gender: formValue?.genderValue,
        country: {
          name: formValue?.country,
          code: formValue?.countryCode
        },
        completeProfile: true,
      }
      await this.apiService.updateDocument(`users/${id}`, data);
    } catch(e) {
      throw(e);
    }
  }

  async updateUserLanguageData(formValue) {
    let id = this.getId();
    //console.log('id:', id, 'formValue:', formValue);
    try {
      const data = {
        motherLanguages: formValue?.motherLanguages,
        studyLanguages: formValue?.studyLanguages,
        languagesArray: formValue?.languagesArray,
        completeLanguages: true,
      }
      await this.apiService.updateDocument(`users/${id}`, data);
    } catch(e) {
      throw(e);
    }
  }

  async updateUserAboutData(currentUser) {
    let id = this.getId();
    //console.log('id:', id, 'formValue:', formValue);
    try {
      const data = {
        aboutMe: currentUser?.aboutMe,
      }
      await this.apiService.updateDocument(`users/${id}`, data);
      this._cUser.next(currentUser);
    } catch(e) {
      throw(e);
    }
  }

  async updateUserStudyLanguagesData(currentUser) {
    let id = this.getId();
    //console.log('id:', id, 'formValue:', formValue);
    try {
      const data = {
        studyLanguages: currentUser?.studyLanguages,
        languagesArray: currentUser?.languagesArray,
      }
      await this.apiService.updateDocument(`users/${id}`, data);
      this._cUser.next(currentUser);
    } catch(e) {
      throw(e);
    }
  }

  async updateUserProfilePictureURL(currentUser) {
    let id = this.getId();
    try {
      const data = {
        photo: currentUser?.photo
      }
      await this.apiService.updateDocument(`users/${id}`, data);
      this._cUser.next(currentUser);
    } catch(e) {
      throw(e);
    }
  }

}