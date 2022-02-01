const { contextBridge, ipcRenderer } = require('electron')
var globalData;
var completedData;
var isTransfering = false;
var allDataCollected = false;

contextBridge.exposeInMainWorld('electron', {
  uploadFile: (filenumber) => {
    ipcRenderer.send('uploadfile', filenumber)
  },
  startTransfer: () => {
    isTransfering = true;
    setDataInHtml();
    ipcRenderer.send('starttransfer');
  },
  cancelTransfer: () => {
    document.getElementById('cancel').disabled = true;
    ipcRenderer.send('canceltransfer');
  },
  setOrderStart: () => {
    var number = document.getElementById('orderNumberInput').value;
    console.log(number);
    ipcRenderer.send('setorderstart', number);
  }
})

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector)
      if (element) element.innerText = text
    }
    ipcRenderer.send('sendsaveddata')
    for (const type of ['chrome', 'node', 'electron']) {
      replaceText(`${type}-version`, process.versions[type])
    }
})

function setDataInHtml(){
  if(!globalData) return;

  if(globalData.filePathOne)
    document.getElementById('pathOne').innerHTML = globalData.filePathOne;
  if(globalData.filePathTwo)
    document.getElementById('pathTwo').innerHTML = globalData.filePathTwo;
  if(globalData.latestOrderNumber != null && globalData.latestOrderNumber != undefined)
    document.getElementById('orderNumber').innerHTML = globalData.latestOrderNumber;
  if(isTransfering){
    document.getElementById('send').disabled = true;
    document.getElementById('cancel').disabled = false;
  }
  else{
    document.getElementById('send').disabled = false;
    document.getElementById('cancel').disabled = true;
  }
  if(completedData){
    if(completedData.failedOrders && completedData.failedOrders.length > 0){
      document.getElementById('failed').innerHTML = completedData.failedOrders.toString();
    }
  }
}
ipcRenderer.on('fetchedstorage', (sender, data) => {
  const parsedData = JSON.parse(data);
  globalData = parsedData;
  console.log(globalData);
  setDataInHtml();
})
ipcRenderer.on('completeddata', (sender, data) => {
  isTransfering = false;
  const parsedData = JSON.parse(data);
  completedData = parsedData;
  setDataInHtml();
})
ipcRenderer.on('consoleinfo', (sender, data) => {
  const parsedData = JSON.parse(data);
  console.log(parsedData);  
})
ipcRenderer.on('alldatacollected', (sender) => {
  allDataCollected = true;
  document.getElementById('send').disabled = false;
})
