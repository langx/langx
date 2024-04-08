import { Component, Input, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Message } from 'src/app/models/Message';
import { tempMessageInterface } from 'src/app/models/types/tempMessage.interface';
import {
  removeMessageFromTempMessagesAction,
  resendMessageFromTempMessagesAction,
} from 'src/app/store/actions/message.action';
import { messagesSelector } from 'src/app/store/selectors/message.selector';

@Component({
  selector: 'app-pre-chat-box',
  templateUrl: './pre-chat-box.component.html',
  styleUrls: ['./pre-chat-box.component.scss'],
})
export class PreChatBoxComponent implements OnInit {
  @Input() tempMsg: tempMessageInterface | null;

  audioRef: HTMLAudioElement = null;
  audioId: string = null;

  replyTo: string = null;
  replyToMessage: Message;

  imageURL$: Observable<URL> = null;
  audioURL$: Observable<URL> = null;

  constructor(private store: Store, private toastController: ToastController) {}

  async ngOnInit() {
    await this.initValues();
    // this.errorHandler();
  }

  async initValues() {
    // Check if the message has replyTo
    if (this.tempMsg.replyTo) {
      // Set the replyTo message id
      this.replyTo = this.tempMsg.replyTo;

      // Get the replyTo message
      this.store
        .pipe(select(messagesSelector))
        .subscribe((messages) => {
          this.replyToMessage = messages.find(
            (msg) => msg?.$id === this.replyTo
          );
        })
        .unsubscribe();
    }

    // Check if the message is an audio
    if (this.tempMsg.type === 'audio') {
      this.audioId = this.tempMsg?.$id;
      await this.readFiles(this.tempMsg?.$id);
    }
  }

  errorHandler() {
    if (this.tempMsg.error) {
      this.presentToast(this.tempMsg.error.message, 'danger');
    }
  }

  private async readFiles(id: string) {
    try {
      const ret = await Filesystem.readFile({
        path: id,
        directory: Directory.Data,
      });
      this.audioRef = new Audio('data:audio/aac;base64,' + ret.data);
    } catch (e) {
      console.error('Unable to read file');
    }
  }

  resendMessage() {
    this.store.dispatch(
      resendMessageFromTempMessagesAction({ request: this.tempMsg })
    );
  }

  deleteMessage() {
    this.store.dispatch(
      removeMessageFromTempMessagesAction({ payload: this.tempMsg })
    );
  }

  // For Audio
  async play(fileName: string) {
    const audioFile = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
    });
    // console.log('Audio file', audioFile);
    const base64Sound = audioFile.data;
    // console.log('Base64 Audio:', base64Sound);

    // Play the audio file
    this.audioRef = new Audio(`data:audio/aac;base64,${base64Sound}`);
    this.audioRef.oncanplaythrough = () => {
      // console.log('Audio file duration', this.audioRef.duration);
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

  async togglePlayStop() {
    if (this.isPlaying()) {
      this.stop();
    } else {
      await this.play(this.audioId);
    }
  }

  isPlaying(): boolean {
    return this.audioRef ? !this.audioRef.paused : false;
  }

  //
  // Utils for clipboard
  //
  writeToClipboard(text: string) {
    if (Capacitor.getPlatform() !== 'web') {
      Clipboard.write({
        string: text,
      })
        .then(() => {
          this.presentToast('Copied!');
        })
        .catch((e) => {
          console.error('Error copying text to clipboard', 'danger');
        });
    }
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
