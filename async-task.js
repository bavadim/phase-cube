/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Bound asynchronous browser APIs that may otherwise leave the start dialog locked. */
window.PuzzleAsync={
  async wait(promise,message,ms=15000){
    let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(message);e.name='TimeoutError';reject(e);},ms);})]);}
    finally{clearTimeout(timer);}
  }
};
