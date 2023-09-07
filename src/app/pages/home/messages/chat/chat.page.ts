import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, NavController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { ChatService } from 'src/app/services/chat/chat.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit {

  @ViewChild(IonContent, { static: false }) content: IonContent;
  
  chatRoomId: string;
  name: string;
  uid: string;
  chats: Observable<any[]>;
  message: string;
  isLoading: boolean = false;
  model = {
    icon: 'chatbubbles-outline',
    title: 'No conversation',
    color: 'warning'
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    public chatService: ChatService,
  ) {}

  ngOnInit() {
    this.initChatPage();
  }

  initChatPage() {
    const data: any = this.route.snapshot.queryParams;
    console.log('route snapshot data: ', data);
    if(data?.name) this.name = data.name;
    if(data?.uid) this.uid = data.uid;
    const chatRoomId: string = this.route.snapshot.paramMap.get('id');
    console.log('check chatId: ', chatRoomId);
    if(!chatRoomId) {
      this.navCtrl.back();
      return;
    }
    this.chatRoomId = chatRoomId;
    this.chatService.getChatRoomMessages(this.chatRoomId);
    this.chats = this.chatService.selectedChatRoomMessages;
    console.log('chat messages ', this.chats);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    if(this.chats) this.content.scrollToBottom();
  }

  async sendMessage(){
    // console.log(this.message);
    if(!this.message || this.message?.trim() == '') return;
    try {
      this.isLoading = true;
      await this.chatService.sendMessage(this.chatRoomId, this.message);
      this.message = '';
      this.isLoading = false;
      this.scrollToBottom();
    } catch(e) {
      this.isLoading = false;
      console.log(e);
      throw(e);
    }
  }

  goProfile(uid : string) {
    console.log('goProfile clicked');
    console.log('uid: ', uid);
    this.router.navigateByUrl(`/home/user/${uid}`);
  } 

}