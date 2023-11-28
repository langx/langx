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

  audioRef: HTMLAudioElement;
  audioUrl: URL;
  audioId: string = null;

  constructor(private store: Store, private el: ElementRef) {}

  ngOnInit() {
    this.initValues();
  }

  ngAfterViewInit() {
    // This is for the seen action when the message is in viewc
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => this.handleIntersect(entry));
    });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer.disconnect();
  }

  initValues() {
    this.msg = { ...this.chat };

    // Check if the message is an audio
    if (this.msg.type === 'audio') {
      this.audioId = this.msg?.$id + '.mp3';
      this.audioUrl = this.msg?.audio;
      this.readFiles(this.msg?.$id);
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
      console.log('File found');
    } catch (e) {
      console.log('File not found, fetching from server');
    }
    // const audioFile = await Filesystem.readFile({
    //   path: id + '.mp31',
    //   directory: Directory.Data,
    // });
    // console.log('Audio file', audioFile);
  }

  // Write a function that downloads audio file from the server to save Filesystem with writeFile
  async downloadFile(url: URL) {
    const response = await fetch(url);
    const blob = await response.blob();
    console.log('Downloaded blob', blob);

    const fileName = new Date().getTime() + '.mp3';

    await Filesystem.writeFile({
      path: fileName,
      data: blob,
      directory: Directory.Data,
    });
    console.log('Download complete');
    // Read file from the filesystem
    const ret = await Filesystem.readdir({
      path: fileName,
      directory: Directory.Data,
    });
    console.log('Read directory', ret);
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
