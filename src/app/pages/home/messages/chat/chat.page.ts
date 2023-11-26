import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, from } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { RecordingData, VoiceRecorder } from 'capacitor-voice-recorder';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Compressor from 'compressorjs';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  GestureController,
  GestureDetail,
  IonContent,
  ModalController,
  ToastController,
} from '@ionic/angular';

// Component Imports
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { tempMessageInterface } from 'src/app/models/types/tempMessage.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';

// Selector and Action Imports
import { accountSelector } from 'src/app/store/selectors/auth.selector';
import { getRoomByIdAction } from 'src/app/store/actions/room.action';
import {
  clearImageUrlStateAction,
  uploadImageForMessageAction,
} from 'src/app/store/actions/bucket.action';
import {
  createMessageAction,
  getMessagesWithOffsetAction,
  deactivateRoomAction,
} from 'src/app/store/actions/message.action';
import {
  errorSelector,
  imageUrlSelector,
  isLoadingOffsetSelector,
  isLoadingSelector,
  messagesSelector,
  roomSelector,
  tempMessagesSelector,
  totalSelector,
  userDataSelector,
} from 'src/app/store/selectors/message.selector';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content: IonContent;
  @ViewChild('recordButton', { read: ElementRef }) recordButton: ElementRef;

  form: FormGroup;

  private subscriptions = new Subscription();
  room$: Observable<RoomExtendedInterface | null>;
  user$: Observable<User | null>;
  currentUser$: Observable<Account | null>;
  isLoading$: Observable<boolean>;
  isLoading_offset$: Observable<boolean>;
  tempMessages$: Observable<tempMessageInterface[] | null>;
  messages$: Observable<Message[] | null>;
  total$: Observable<number | null> = null;

  isTyping: boolean = false;
  roomId: string;

  // Add a flag to indicate whether it's the first load
  private isFirstLoad: boolean = true;

  model = {
    icon: 'chatbubbles-outline',
    title: 'No conversation',
    color: 'warning',
  };

  // Recording Audio Variables
  isRecording: boolean = false;
  micPermission: boolean = false;
  storedFileNames: FileInfo[] = [];
  iconColorOfMic: string = 'medium';
  audioRef: HTMLAudioElement;

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private router: Router,
    private modalCtrl: ModalController,
    private toastController: ToastController,
    private gestureCtrl: GestureController
  ) {}

  async ngOnInit() {
    this.initValues();
    this.initForm();
  }

  ngAfterViewInit() {
    this.initValuesAfterViewInit();
    this.enableLongPress();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();

    this.room$
      .subscribe((room) => {
        if (room) {
          this.store.dispatch(deactivateRoomAction({ payload: room }));
        }
      })
      .unsubscribe();
  }

  initValues() {
    this.roomId = this.route.snapshot.paramMap.get('id') || null;

    this.room$ = this.store.pipe(select(roomSelector));
    this.user$ = this.store.pipe(select(userDataSelector));
    this.currentUser$ = this.store.pipe(select(accountSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.isLoading_offset$ = this.store.pipe(select(isLoadingOffsetSelector));
    this.tempMessages$ = this.store.pipe(select(tempMessagesSelector));
    this.messages$ = this.store.pipe(select(messagesSelector));
    this.total$ = this.store.pipe(select(totalSelector));

    // Check room$ and currentUser$ for null
    this.room$
      .subscribe((room) => {
        if (!room) {
          this.currentUser$
            .subscribe((currentUser) => {
              this.store.dispatch(
                getRoomByIdAction({
                  currentUserId: currentUser.$id,
                  roomId: this.roomId,
                })
              );
            })
            .unsubscribe();
        }
      })
      .unsubscribe();
  }

  initForm() {
    this.form = new FormGroup({
      body: new FormControl('', {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
    });
  }

  initValuesAfterViewInit() {
    // To Scroll to bottom triggers
    this.subscriptions.add(
      this.tempMessages$.subscribe((msg) => {
        if (msg != null) {
          this.subscriptions.add(
            this.isUserAtBottom().subscribe((isAtBottom) => {
              if (isAtBottom || this.isFirstLoad) {
                setTimeout(() => {
                  this.content.scrollToBottom(300);
                }, 0);
              }
            })
          );
        }
      })
    );

    this.subscriptions.add(
      this.room$.subscribe((room) => {
        if (room != null) {
          this.subscriptions.add(
            this.isUserAtBottom().subscribe((isAtBottom) => {
              if (isAtBottom || this.isFirstLoad) {
                // Wait for the view to update then scroll to bottom
                setTimeout(() => {
                  this.content.scrollToBottom(0);
                  // After the first load, set the flag to false
                  this.isFirstLoad = false;
                }, 0);
              }
            })
          );
        }
      })
    );

    // Uploaded Image URL to present
    this.subscriptions.add(
      this.store.pipe(select(imageUrlSelector)).subscribe((url: URL) => {
        if (url) {
          this.store.dispatch(clearImageUrlStateAction());
          this.createMessageWithImage(url);
        }
      })
    );

    // Present Toast if error
    this.subscriptions.add(
      this.store
        .pipe(select(errorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of messages that we already have
    let offset: number = 0;

    this.messages$
      .subscribe((messages) => {
        offset = messages.length;
        this.total$
          .subscribe((total) => {
            if (offset < total) {
              this.store.dispatch(
                getMessagesWithOffsetAction({
                  roomId: this.roomId,
                  offset: offset,
                })
              );
            } else {
              event.target.disabled = true;
              console.log('All messages loaded');
            }
          })
          .unsubscribe();
      })
      .unsubscribe();

    event.target.complete();
  }

  submitForm() {
    this.currentUser$
      .subscribe((currentUser) => {
        this.user$
          .subscribe((user) => {
            this.createMessageWithText(currentUser, user);
          })
          .unsubscribe();
      })
      .unsubscribe();
  }

  createMessageWithText(currentUser: any, user: any) {
    const request: createMessageRequestInterface = {
      body: this.form.value.body,
      roomId: this.roomId,
      to: user.$id,
      isImage: false,
    };
    this.store.dispatch(
      createMessageAction({ request, currentUserId: currentUser.$id })
    );
    this.form.reset();
  }

  createMessageWithImage(image: URL) {
    this.currentUser$
      .subscribe((currentUser) => {
        this.user$
          .subscribe((user) => {
            const request: createMessageRequestInterface = {
              roomId: this.roomId,
              to: user.$id,
              isImage: true,
              image: image,
            };
            this.store.dispatch(
              createMessageAction({ request, currentUserId: currentUser.$id })
            );
            this.form.reset();
          })
          .unsubscribe();
      })
      .unsubscribe();
  }

  typingFocus() {
    this.isTyping = true;
    this.onTypingStatusChange();
  }

  typingBlur() {
    this.isTyping = false;
    this.onTypingStatusChange();
  }

  onTypingStatusChange() {
    console.log('onTypingStatusChange', this.isTyping);
  }

  redirectUserProfile() {
    this.user$
      .subscribe((user) => {
        this.router.navigateByUrl(`/home/user/${user.$id}`);
      })
      .unsubscribe();
  }

  //
  // Select Image
  //

  async selectImage() {
    try {
      await this.requestCameraPermissions();

      const image = await this.getCameraPhoto();

      if (!image) return;

      const modal = await this.createImageCropModal(image);

      await modal.onDidDismiss().then(async (data) => {
        await this.handleModalDismiss(data);
      });
    } catch (e) {
      console.log(e);
    }
  }

  //
  // Record Audio
  //

  enableLongPress() {
    const longPress = this.gestureCtrl.create(
      {
        el: this.recordButton.nativeElement,
        gestureName: 'long-press',
        threshold: 0,
        onWillStart: async (_: GestureDetail) => {
          await this.stop();
          this.loadFiles();
          await this.checkMicPermission();
          return Promise.resolve();
        },
        onStart: () => {
          if (!this.micPermission || this.isRecording) return;
          this.startRecording();
          Haptics.impact({ style: ImpactStyle.Light });
          this.changeColor('danger');
        },
        onEnd: () => {
          if (!this.micPermission || !this.isRecording) return;
          this.stopRecording();
          Haptics.impact({ style: ImpactStyle.Light });
          this.changeColor('medium');
        },
      },
      true
    );

    longPress.enable();
  }

  //
  // Utils for image upload
  //

  private async requestCameraPermissions() {
    if (Capacitor.getPlatform() != 'web') await Camera.requestPermissions();
  }

  private async getCameraPhoto() {
    return await Camera.getPhoto({
      quality: 100,
      allowEditing: true,
      source: CameraSource.Prompt,
      resultType: CameraResultType.DataUrl,
    }).catch((error) => {
      console.log(error);
    });
  }

  private async createImageCropModal(image) {
    const modal = await this.modalCtrl.create({
      component: ImageCropComponent,
      componentProps: {
        image: image,
      },
    });
    modal.present();
    return modal;
  }

  private async handleModalDismiss(data) {
    if (data?.data) {
      let blob: Blob = this.dataURLtoBlob(data.data);
      console.log(`Original size: ${blob.size}`);

      blob = await this.checkFileSize(blob);
      console.log(`Final size: ${blob.size}`);

      let file = new File([blob], this.roomId, {
        type: blob.type,
      });

      this.uploadImage(file);
    } else {
      this.presentToast('Image not selected properly.', 'danger');
    }
  }

  private uploadImage(file) {
    this.store.dispatch(
      uploadImageForMessageAction({
        request: file,
      })
    );
  }

  private dataURLtoBlob(dataurl: any) {
    var arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  private async checkFileSize(
    blob: Blob,
    quality: number = 0.6,
    attempts: number = 0
  ): Promise<Blob> {
    // console.log(`Checking size: ${blob.size}`);
    if (blob.size > 2000000 && attempts < 10) {
      // limit to 5 attempts
      const compressedBlob = await this.compressImage(blob, quality);
      return this.checkFileSize(compressedBlob, quality * 0.8, attempts + 1);
    }
    return blob;
  }

  private compressImage(blob: Blob, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      new Compressor(blob, {
        quality: quality,
        success: (result: Blob) => {
          // console.log(`Compressed from ${blob.size} to ${result.size}`);
          resolve(result);
        },
        error: (error: Error) => {
          // console.log(`Compression error: ${error.message}`);
          reject(error);
        },
      });
    });
  }

  //
  // Utils for record audio
  //

  private async checkMicPermission() {
    if (Capacitor.getPlatform() != 'web') {
      this.micPermission = (
        await VoiceRecorder.hasAudioRecordingPermission()
      ).value;
      if (!this.micPermission) {
        this.micPermission = (
          await VoiceRecorder.requestAudioRecordingPermission()
        ).value;
      }
    } else {
      this.micPermission = true;
    }
  }

  private startRecording() {
    VoiceRecorder.startRecording().then(() => {
      this.isRecording = true;
    });
  }

  private stopRecording() {
    VoiceRecorder.stopRecording().then(async (result: RecordingData) => {
      this.isRecording = false;
      if (result.value && result.value.recordDataBase64) {
        const recordData = result.value.recordDataBase64;

        // Save the file to the device
        const fileName = `${this.roomId}.m4a`;
        await this.saveRecording(recordData, fileName);
      }
    });
  }

  private async loadFiles() {
    Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    }).then((result) => {
      console.log('Directory listing', result);
      this.storedFileNames = result.files;
    });
  }

  private async saveRecording(recordData: string, fileName: string) {
    await Filesystem.writeFile({
      path: fileName,
      data: recordData,
      directory: Directory.Data,
    });

    this.loadFiles();
  }

  async deleteRecording(fileName: string) {
    await this.stop();
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Data,
    });
    this.loadFiles();
  }

  async play(fileName: string) {
    const audioFile = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
    });
    // console.log('Audio file', audioFile);
    const base64Sound = audioFile.data;

    // Play the audio file
    this.audioRef = new Audio(`data:audio/mp3;base64,${base64Sound}`);
    this.audioRef.oncanplaythrough = () => {
      console.log('Audio file duration', this.audioRef.duration);
    };
    this.audioRef.onended = () => {
      this.audioRef = null;
    };
    this.audioRef.load();
    return this.audioRef.play();
  }

  async stop() {
    if (this.audioRef) {
      this.audioRef.pause();
      this.audioRef.currentTime = 0;
    }
  }

  async togglePlayStop(fileName: string) {
    if (this.isPlaying()) {
      this.stop();
    } else {
      await this.play(fileName);
    }
  }

  isPlaying(): boolean {
    return this.audioRef ? !this.audioRef.paused : false;
  }

  changeColor(color: string) {
    this.iconColorOfMic = color;
  }

  //
  // Utils for scroll to bottom
  //

  isUserAtBottom(): Observable<boolean> {
    return from(this.checkIfUserAtBottom());
  }

  async checkIfUserAtBottom(): Promise<boolean> {
    const scrollElement = await this.content.getScrollElement();
    // Calculate the bottom 10% position
    const bottomPosition = scrollElement.scrollHeight * 0.9;
    // The chat is considered to be at the bottom if the scroll position is greater than the bottom 10% position
    const atBottom =
      scrollElement.scrollTop + scrollElement.clientHeight >= bottomPosition;
    return atBottom;
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
