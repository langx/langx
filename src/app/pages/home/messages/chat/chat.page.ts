import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription, from } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, FileInfo } from '@capacitor/filesystem';
import { RecordingData, VoiceRecorder } from 'capacitor-voice-recorder';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import Compressor from 'compressorjs';
import {
  GestureController,
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
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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
  storedFileNames: FileInfo[] = [];
  iconColorOfMic: string = 'medium';
  audioRef: HTMLAudioElement;
  micPermission: boolean = false;

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

    // Recording Feature
    this.loadFiles();
    if (Capacitor.getPlatform() != 'web') {
      this.micPermission = (
        await VoiceRecorder.hasAudioRecordingPermission()
      ).value;
      if (!this.micPermission) {
        await VoiceRecorder.requestAudioRecordingPermission();
      }
    }
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

  createMessage() {
    this.currentUser$
      .subscribe((currentUser) => {
        this.user$
          .subscribe((user) => {
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
          })
          .unsubscribe();
      })
      .unsubscribe();
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

  // TODO: Do we need this function?
  search() {
    console.log('test clicked', this.content);
    // TODO: We already have global scroll to bottom function
    this.content.scrollToBottom(1500).then(() => {
      console.log('scrolled to bottom');
    });
  }

  //
  // Select Image
  //

  async selectImage() {
    try {
      if (Capacitor.getPlatform() != 'web') await Camera.requestPermissions();

      // TODO: Capacitor pop up style is not good. It should be changed.
      const image = await Camera.getPhoto({
        quality: 100,
        allowEditing: true,
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl,
      }).catch((error) => {
        console.log(error);
      });

      if (!image) return;

      const modal = await this.modalCtrl.create({
        component: ImageCropComponent,
        componentProps: {
          image: image,
        },
      });
      modal.present();

      // TODO: Comment logs
      await modal.onDidDismiss().then(async (data) => {
        if (data?.data) {
          // URL to Blob
          let blob: Blob = this.dataURLtoBlob(data.data);
          console.log(`Original size: ${blob.size}`);

          // Check size of the file here
          blob = await this.checkFileSize(blob);
          console.log(`Final size: ${blob.size}`);

          // Blob to File
          let file = new File([blob], this.roomId, {
            type: blob.type,
          });

          // Upload File
          this.store.dispatch(
            uploadImageForMessageAction({
              request: file,
            })
          );
        } else {
          this.presentToast('Image not selected properly.', 'danger');
        }
      });
    } catch (e) {
      console.log(e);
    }
  }

  //
  // Record Audio
  //

  // Recording Feature
  async loadFiles() {
    Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    }).then((result) => {
      console.log('Directory listing', result);
      this.storedFileNames = result.files;
    });
  }

  startRecording() {
    if (this.isRecording) {
      return;
    }
    this.isRecording = true;
    VoiceRecorder.startRecording();
  }

  stopRecording() {
    if (!this.isRecording) {
      return;
    }
    VoiceRecorder.stopRecording().then(async (result: RecordingData) => {
      this.isRecording = false;
      if (result.value && result.value.recordDataBase64) {
        const recordData = result.value.recordDataBase64;
        // console.log('Recorded data', recordData);

        // Save the file to the device
        const fileName = `${this.roomId}.m4a`;
        await Filesystem.writeFile({
          path: fileName,
          data: recordData,
          directory: Directory.Data,
        });

        this.loadFiles();
      }
    });
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
    this.audioRef.load();
    return this.audioRef.play();
  }

  stop() {
    if (this.audioRef) {
      this.audioRef.pause();
      this.audioRef.currentTime = 0;
    }
  }

  async deleteRecording(fileName: string) {
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Data,
    });
    this.loadFiles();
  }

  //
  // Utils for record audio
  //

  changeColor(color: string) {
    this.iconColorOfMic = color;
  }

  enableLongPress() {
    const longPress = this.gestureCtrl.create(
      {
        el: this.recordButton.nativeElement,
        gestureName: 'long-press',
        threshold: 0,
        onStart: () => {
          this.startRecording();
          Haptics.impact({ style: ImpactStyle.Light });
          this.changeColor('danger');
        },
        onEnd: () => {
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
