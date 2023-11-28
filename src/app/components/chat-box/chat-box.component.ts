import { Store } from '@ngrx/store';
import { Directory, FileInfo, Filesystem } from '@capacitor/filesystem';
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
  storedFileNames: FileInfo[] = [];
  audioRef: HTMLAudioElement;

  constructor(private store: Store, private el: ElementRef) {}

  ngOnInit() {
    this.msg = { ...this.chat };
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

  handleIntersect(entry) {
    if (entry.isIntersecting) {
      if (this.msg.to === this.current_user_id && this.msg.seen === false) {
        this.msg.seen = true;
        // Dispatch action to update message seen status
        this.store.dispatch(updateMessageSeenAction({ request: this.msg }));
      }
    }
  }
  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'now';
    return time;
  }

  //
  // Utils for audio
  //

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
}
