import { Store } from '@ngrx/store';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  Component,
  Input,
  OnInit,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';

import { lastSeen } from 'src/app/extras/utils';
import { Message } from 'src/app/models/Message';
import { updateMessageSeenAction } from 'src/app/store/actions/message.action';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() chat: Message;
  @Input() current_user_id: string;

  private observer: IntersectionObserver;

  msg: Message = null;

  audioRef: HTMLAudioElement = null;
  audioUrl: URL;
  audioId: string = null;
  isDownloaded: boolean = false;

  constructor(private store: Store, private el: ElementRef) {}

  async ngOnInit() {
    await this.initValues();
  }

  ngAfterViewInit() {
    // This is for the seen action when the message is in view
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => this.handleIntersect(entry));
    });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer.disconnect();
  }

  async initValues() {
    this.msg = { ...this.chat };

    // Check if the message is an audio
    if (this.msg.type === 'audio') {
      this.audioId = this.msg?.$id + '.mp3';
      this.audioUrl = this.msg?.audio;
      await this.readFiles(this.msg?.$id);
    }
  }

  //
  // Utils for audio
  //

  private async readFiles(id: string) {
    try {
      const ret = await Filesystem.readFile({
        path: id + '.mp3',
        directory: Directory.Data,
      });
      this.audioRef = new Audio('data:audio/mp3;base64,' + ret.data);

      console.log('File found');
      this.isDownloaded = true;
    } catch (e) {
      console.log('File not found, fetching from server');
      // TODO : Download file from server
      // this.downloadFile();
    }
  }

  // TODO : Download file from server logic
  async downloadFile() {
    const response = await fetch(this.msg?.audio);
    const blob = await response.blob();

    // Create a new FileReader instance
    const reader = new FileReader();

    const base64Audio = await new Promise((resolve) => {
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });

    // TODO: Take a look here to see if we can use the base64Audio directly
    const base64AudioString = base64Audio.toString();

    const fileName = this.msg.$id + '.mp3';
    await Filesystem.writeFile({
      path: fileName,
      data: base64AudioString,
      directory: Directory.Data,
    });

    console.log('Download complete');
    this.isDownloaded = true;
  }

  async play(fileName: string) {
    const audioFile = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
    });
    // console.log('Audio file', audioFile);
    const base64Sound = audioFile.data;
    // console.log('Base64 Audio:', base64Sound);

    // Play the audio file
    this.audioRef = new Audio(`data:audio/mp3;base64,${base64Sound}`);
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
  // Utils for seen
  //

  handleIntersect(entry) {
    if (entry.isIntersecting) {
      if (this.msg.to === this.current_user_id && this.msg.seen === false) {
        this.msg.seen = true;
        // Dispatch action to update message seen status
        this.store.dispatch(updateMessageSeenAction({ request: this.msg }));
      }
    }
  }

  //
  // Utils for time
  //

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'now';
    return time;
  }
}
