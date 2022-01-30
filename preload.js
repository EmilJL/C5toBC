const { contextBridge, ipcRenderer } = require('electron')
var globalData;

contextBridge.exposeInMainWorld('electron', {
  uploadFile: (filenumber) => {
    ipcRenderer.send('uploadfile', filenumber)
  },
  startTransfer: () => {
    ipcRenderer.send('starttransfer');
  },
  stopTransfer: () => {
    ipcRenderer.send('stoptransfer');
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
}

ipcRenderer.on('nice', (sender, filepath) => {
  console.log("huh");
  console.log(filepath);
})

ipcRenderer.on('fetchedstorage', (sender, data) => {
  console.log("thefack");
  const parsedData = JSON.parse(data);
  console.log(parsedData);
  globalData = parsedData;
  setDataInHtml();
})