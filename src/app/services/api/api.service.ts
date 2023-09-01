import { Injectable } from '@angular/core';
import { Firestore, OrderByDirection, Query, addDoc, collection, collectionData, doc, docData, getDoc, getDocs, limit, orderBy, query, setDoc, startAfter, updateDoc, where } from '@angular/fire/firestore';

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

  setDocument(path, data, options?) {
    const dataRef = this.docRef(path);
    return setDoc<any>(dataRef, data, options); //set()
  }

  updateDocument(path, data) {
    const dataRef = this.docRef(path);
    return updateDoc<any>(dataRef, data); //set()
  }

  addDocument(path, data) {
    const dataRef = this.collectionRef(path);
    return addDoc<any>(dataRef, data); //add()
  }

  getDocById(path) {
    const dataRef = this.docRef(path);
    return getDoc(dataRef);
  }

  getDocs2(query) {
    return getDocs<any>(query);
  }

  getDocs(path, queryFn?, queryFn2?, queryFn3?, queryFn4?) {
    let dataRef: any = this.collectionRef(path);

    // TODO: Here has to make logic better
    if(queryFn && queryFn2 && queryFn3 && queryFn4) {
      const q = query(dataRef, queryFn, queryFn2, queryFn3, queryFn4);
      dataRef = q;
    } else if(queryFn && queryFn2 && queryFn3) {
      const q = query(dataRef, queryFn, queryFn2, queryFn3);
      dataRef = q;
    } else if(queryFn && queryFn2) {
      const q = query(dataRef, queryFn, queryFn2);
      dataRef = q;
    } else if(queryFn) {
      const q = query(dataRef, queryFn);
      dataRef = q;
    }
    
    return getDocs<any>(dataRef); //get()
  }

  collectionDataQuery(path, queryFn?, queryFn2?, queryFn3?) {
    let dataRef: any = this.collectionRef(path);
    
    // TODO: Here has to make logic better
    if(queryFn && queryFn2 && queryFn3) {
      const q = query(dataRef, queryFn, queryFn2, queryFn3);
      dataRef = q;
    } else if(queryFn && queryFn2) {
      const q = query(dataRef, queryFn, queryFn2);
      dataRef = q;
    } else if(queryFn) {
      const q = query(dataRef, queryFn);
      dataRef = q;
    }

    const collection_data = collectionData<any>(dataRef, {idField: 'id'});
    return collection_data;
  }

  docDataQuery(path, id?, queryFn?) {
    let dataRef: any = this.docRef(path);
    if(queryFn) {
      const q = query(dataRef, queryFn);
      dataRef = q;
    }
    let doc_data;
    if(id) doc_data = docData<any>(dataRef, {idField: 'id'});
    else doc_data = docData<any>(dataRef);
    return doc_data;
  }

  whereQuery(fieldPath, condition, value) {
     return where(fieldPath, condition, value);
  }

  orderByQuery(fieldPath, directionStr: OrderByDirection = 'asc') {
    return orderBy(fieldPath, directionStr);
  }

  limitQuery(number) {
    return limit(number);
  }

  startAfterQuery(doc) {
    return startAfter(doc);
  }

}