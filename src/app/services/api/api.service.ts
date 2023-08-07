import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, getDoc, getDocs, query, setDoc, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private firestore: Firestore
  ) { }

  docRef(path) {
    return doc(this.firestore, path);
  }

  collectionRef(path) {
    return collection(this.firestore, path);
  }

  setDocument(path, data) {
    const dataRef = this.docRef(path);
    return setDoc<any>(dataRef, data); //set()
  }

  addDocument(path, data) {
    const dataRef = this.collectionRef(path);
    return addDoc<any>(dataRef, data); //add()
  }

  getDocById(path) {
    const dataRef = this.docRef(path);
    return getDoc(dataRef);
  }

  getDocs(path, queryFn?) {
    let dataRef: any = this.collectionRef(path);
    if(queryFn) {
      const q = query(dataRef, queryFn);
      dataRef = q;
    }
    return getDocs<any>(dataRef); //get()
  }

  collectionDataQuery(path, queryFn?) {
    let dataRef: any = this.collectionRef(path);
    if(queryFn) {
      const q = query(dataRef, queryFn);
      dataRef = q;
    }
    const collection_data = collectionData<any>(dataRef);
    return collection_data;
  }

  whereQuery(fieldPath, condition, value) {
     return where(fieldPath, condition, value);
  }

}