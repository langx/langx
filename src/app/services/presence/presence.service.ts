import { Injectable } from '@angular/core';
import {
  Database,
  onDisconnect,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
} from '@angular/fire/database';

@Injectable({
  providedIn: 'root',
})
export class PresenceService {
  constructor(private db: Database) {}

  // TODO: it may move to presence.service.ts
  updatePresence(id: string) {
    const myConnectionsRef = ref(this.db, 'users/' + id + '/connections');
    const lastOnlineRef = ref(this.db, 'users/' + id + '/lastSeen');
    const connectedRef = ref(this.db, '.info/connected');
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        const con = push(myConnectionsRef);
        onDisconnect(con).remove();
        set(con, true).then(() => {
          console.log('user connected to realtime db');
        });
        onDisconnect(lastOnlineRef).set(serverTimestamp());
      }
    });
  }
}
