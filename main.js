const { app, dialog, ipcMain, BrowserWindow } = require('electron')
const os = require('os');
const storage = require('electron-json-storage');
const path = require('path')
const fs = require('fs')
const https = require('https')
const readXlsxFile = require('read-excel-file/node')

require('electron-reload')(__dirname);


var win;
var globalData;

function createWindow () {
  win = new BrowserWindow({
    width: 1500,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    storage.setDataPath(os.tmpdir());
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

var filePathOne;
var filePathTwo;
var latestOrderNumber;

ipcMain.on('sendsaveddata', () => {
  sendSavedData();
})

function sendSavedData () {
  storage.getAll((error, data) => { 
    globalData = data;
    console.log(globalData);
    win.webContents.send('fetchedstorage', JSON.stringify(data));
  })
}

ipcMain.on('setorderstart', (event, number) => {
  console.log("huh");
  console.log(number);
  storage.set('latestOrderNumber', number);
  sendSavedData();
})

ipcMain.on('uploadfile', (event, filenumber) => {
  dialog.showOpenDialog({ properties: ['openFile'] }).then((file) => {
    if(file && file.filePaths && file.filePaths[0]){
      console.log(filenumber);
      if(filenumber == 1){
        filePathOne = file.filePaths[0];
        storage.set('filePathOne', filePathOne)
      }
      else if(filenumber == 2){
        filePathTwo = file.filePaths[0];
        storage.set('filePathTwo', filePathTwo)
      }
      sendSavedData();
    } 
  })
})

ipcMain.on('starttransfer', (event) => {
  console.log(globalData);
  var orders = [];
  readXlsxFile(fs.createReadStream(globalData.filePathOne)).then((rows) => {
    var order = {};
    var rowsTohandle = [];
    rows.shift();
    rows.forEach(row => {
      if(row[0] > globalData.latestOrderNumber){
        rowsTohandle.push(row);
      }
    });
    rowsTohandle.forEach(row => {
      order.id = row[0];
      order.customerNumber = row[13];
      var currency = row[19];
      if(currency == "US$")
        currency = "USD"
      order.currencyCode = currency;
      order.businessCentralInstanceId = "IFDK";
      order.isBackorder = false;
      order.hasSeperateShippingAddress = false;
      
      // FIND OUT IF AND WHY
      // order.isB2B
      if(row[8]){
        var billingCityPostalState = row[8].split(' ');
        var billingCity = "";
        var billingState = "";
        var billingPostalCode = "";
        if(row[9] == "USA"){
          if(billingCityPostalState.count == 2){
            billingState = billingCityPostalState[1];
          }
          else{
            for (let index = 0; index < billingCityPostalState.length; index++) {
              if(index != 0)
              billingState = billingState + billingCityPostalState[index];
            }
          }
        }
        else{
          if(billingCityPostalState.count == 2){
            billingCity = billingCityPostalState[1];
          }
          else{
            for (let index = 0; index < billingCityPostalState.length; index++) {
              if(index != 0)
                billingCity = billingCity + billingCityPostalState[index];
            }
          }
        }
        billingPostalCode = billingCityPostalState[0] ? billingCityPostalState[0] : '';
      }

      if(row[34]){
        var shippingCityPostalState = row[34].split(' ');
        var shippingCity = "";
        var shippingState = "";
        var shippingPostalCode = "";
        if(row[9] == "USA"){
          if(shippingCityPostalState.count == 2){
            shippingState = shippingCityPostalState[1];
          }
          else{
            for (let index = 0; index < shippingCityPostalState.length; index++) {
              if(index != 0)
              shippingState = shippingState + shippingCityPostalState[index];
            }
          }
        }
        else{
          if(shippingCityPostalState.count == 2){
            shippingCity = shippingCityPostalState[1];
          }
          else{
            for (let index = 0; index < shippingCityPostalState.length; index++) {
              if(index != 0)
                shippingCity = shippingCity + shippingCityPostalState[index];
            }
          }
        }
        shippingPostalCode = shippingCityPostalState[0] ? shippingCityPostalState[0] : '';
      }

      order.billingAddress = {
        name: row[5],
        contact: row[10],
        addressLine1: row[6],
        addressLine2: row[7],
        city: billingCity,
        country: row[9],
        state: billingState,
        postCode: billingPostalCode
      }
      order.shippingAddress = {
        name: row[31],
        contact: "",
        addressLine1: row[32],
        addressLine2: row[33],
        city: shippingCity,
        country: row[35],
        state: shippingState,
        postCode: shippingPostalCode
      }
      order.customerPhone = row[11];
      order.customerEmail = row[64];
      order.notes = '';
      order.paymentProvider = '';
      order.paymentReference = '';
      order.salesPersonCode = 'C5';
      order.externalDocumentNumber = row[0]

      // CHECK FREIGHTFORWARDER ETC (er lige nu DDP, EXW, DAP eller tom)

      // ALSO FIND PAYMENT TYPE

      order.grossWeight = row[76];
      orders.push(order);
    });
    console.log(orders[0]);
  }).catch((err) => {
    console.log(err);
  })
})

// const orderSchema = {
//   'Nummer': {
//     // JSON object property name.
//     prop: 'nummer',
//     type: Number,
//     required: true
//   },
//   'Søgenavn': {
//     prop: 'searchName',
//     type: String,
//   },
//   'Oprettet': {
//     prop: 'createdDate',
//     type: Date
//   },
//   'Leveres': {
//     prop: 'deliveryDate',
//     type: Date
//   },
//   'Konto': {
//     prop: 'account',
//     type: String
//   },
//   'Navn': {
//     prop: 'name',
//     type: String
//   },
//   'Addresse 1': {
//     prop: 'addressOne',
//     type: String
//   },
//   'Addresse 2': {
//     prop: 'addressTwo',
//     type: String
//   },
//   'Postnr/by': {
//     prop: 'postalCity',
//     type: String
//   },
//   'Land/område': {
//     prop: 'country',
//     type: String
//   },
//   'Attention': {
//     prop: 'attention',
//     type: String
//   },
//   'Telefon': {
//     prop: 'phone',
//     type: String
//   },
//   'Pricegruppe': {
//     prop: 'priceGroup',
//     type: String
//   },
//   'Rabatgruppe': {
//     prop: 'discountGroup',
//     type: String
//   },
//   'Valuta': {
//     prop: 'currency',
//     type: String
//   },
//   'Betaling': {
//     prop: 'paymentMethod',
//     type: String
//   },
//   'Levering': {
//     prop: 'delivery',
//     type: String
//   },
//   'Moms': {
//     prop: 'vatType',
//     type: String
//   },
//   'Lev. navn': {
//     prop: 'deliveryName',
//     type: String
//   },
//   'Lev. adr': {
//     prop: 'deliveryAddress',
//     type: String
//   },
//   'Lev. adr (1)': {
//     prop: 'deliveryAddressOne',
//     type: String
//   },
//   'Lev. adr (2)': {
//     prop: 'deliveryAddressTwo',
//     type: String
//   },
//   'Lev. land': {
//     prop: 'deliveryCountry',
//     type: String
//   },
//   'Deres ref': {
//     prop: 'referenceNumber',
//     type: String
//   },
//   'Momsberegnes': {
//     prop: 'vatCalculated',
//     type: String
//   },
//   'Gebyr f.m.': {
//     prop: 'fee',
//     type: Number
//   },
//   'Momsbeløb': {
//     prop: 'vat',
//     type: Number
//   },
//   'Linjerabat': {
//     prop: 'discount',
//     type: Number
//   },
//   'Varebeløb': {
//     prop: 'price',
//     type: Number
//   },
//   'eNummer': {
//     prop: 'eNumber',
//     type: Number
//   },
//   'E-mail': {
//     prop: 'email',
//     type: String
//   },
//   'Vægt': {
//     prop: 'grossWeight',
//     type: Number
//   }
// }