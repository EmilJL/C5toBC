const { app, dialog, ipcMain, BrowserWindow } = require('electron')
const os = require('os');
const storage = require('electron-json-storage');
const path = require('path')
const fs = require('fs')
const https = require('https')
const readXlsxFile = require('read-excel-file/node')
const axios = require('axios').default;
require('dotenv').config();

require('electron-reload')(__dirname);


var win;
var globalData;

function createWindow () {
  win = new BrowserWindow({
    width: 1000,
    height: 1000,
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
const skuConvertion = [];
const customerConvertion = [];

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
  
  console.log(process.env.CUSTOM_ORDER_API_PATH);
  console.log(process.env.BASIC_API_PATH);
  console.log(process.env.TOKEN_USER);
  console.log(process.env.TOKEN_KEY);
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

ipcMain.on('starttransfer', async (event) => {
  console.log(globalData);
  
  readXlsxFile(fs.createReadStream("./skuConvertion.xlsx")).then((rows) => {
    rows.forEach(row => {
      skuConvertion.push({old: row[0], new: row[2]});
    })
  })
  .then(() => {
    readXlsxFile(fs.createReadStream("./customerConvertion.xlsx")).then((rows) => {
      rows.forEach(row => {
        customerConvertion.push({old: row[0], new: row[1]});
      })
    })
  })
  .then(() => {
    var orders = [];
    readXlsxFile(fs.createReadStream(globalData.filePathOne)).then((rows) => {
      var rowsTohandle = [];
      rows.shift();
      rows.forEach(row => {
        if(parseInt(row[0]) > parseInt(globalData.latestOrderNumber)){
          rowsTohandle.push(row);
        }
      });
      rowsTohandle.forEach(row => {
        var order = {};
        // order.id = row[0];
        var isB2B = false;
        order.id = row[0];
        order.customerNumber = row[13];
        if(order.customerNumber.toString().length != 2){
          // console.log(order.customerNumber);
          isB2B = true;
          order.customerNumber = customerConvertion.find(c => c.old === order.customerNumber).new;
        }
        else{
          order.sellToCountry = row[13];
          order.shipToCountry = row[13];
        }
        var currency = row[19];
        if(currency == "US$")
          currency = "USD"
        order.currencyCode = currency;
        // order.businessCentralInstanceId = "IFDK";
        // order.isBackorder = false;
        // order.hasSeperateShippingAddress = false;
        
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
              billingCity = billingCity.replace('/', '');
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
              shippingCity = shippingCity.replace('/', '');
            }
          }
          shippingPostalCode = shippingCityPostalState[0] ? shippingCityPostalState[0] : '';
        }
  
        order.customerName = row[5];
        order.sellToAddressLine1 = row[6];
        order.sellToAddressLine2 = row[7] ? row[7] : '';
        order.sellToCity = billingCity;
        // order.sellToCountry = row[9];
        order.sellToState = billingState;
        order.sellToPostCode = billingPostalCode;
  
        order.shipToName = row[31];
        order.shipToContact = row[10];
        order.shipToAddressLine1 = row[32];
        order.shipToAddressLine2 = row[33] ? row[33] : '';
        order.shipToCity = shippingCity;
        // order.shipToCountry = row[35];
        order.shipToState = shippingState;
        order.shipToPostCode = shippingPostalCode;
  
        order.phoneNumber = row[11];
        order.email = row[64];
        // order.notes = '';
        // order.paymentProvider = '';
        // order.paymentReference = '';
        order.externalDocumentNumber = row[0]
        
        // CHECK FREIGHTFORWARDER ETC (er lige nu DDP, EXW, DAP eller tom)
        
        // ALSO FIND PAYMENT TYPE AND order.currencyCode
        order.currencyCode="USD";
        order.grossWeight = row[76];

        orders.push(order);
      });
      orders.sort(function(a, b) {
        return parseFloat(a.id) - parseFloat(b.id);
      });
      return orders;
    })
    .then((result) => {
      sendOrdersToBC(result);
    })
    .catch((err) => {
      console.log(err);
    })
  })
  .catch((err) => {
    console.log(err);
  })
});

async function sendOrdersToBC(orders){
  const indexToStartAt = orders.findIndex(item => item.id == globalData.latestOrderNumber) + 1;
  var failedOrders = [];
  // var currentlyHandledOrderNumber = 0;
  for (let index = 0; indexToStartAt < orders.length; index++) {
    var order = orders[index];
    if(order){
      var currentNumber = order.id;
      // currentlyHandledOrderNumber = currentNumber;
      delete order.id;
      var response = await sendOrderToBC(order);
      if((response.status != 201 && response.status != 200) || !response || !response.data || !response.data.id){
        order.id = currentNumber
        failedOrders.push(order);
      }
      var orderLines = await getOrderLinesByOrderID(currentNumber, response.data.id);
      //insert logic
    // storage.set('latestOrderNumber', currentNumber);
    // globalData.latestOrderNumber = currentNumber;
      console.log("success - " + currentNumber);
      // currentlyHandledOrderNumber = 0;
    }
  }
}
// async function getOrderID()

async function getOrderLinesByOrderID(orderNumber, orderID){
  return readXlsxFile(fs.createReadStream(globalData.filePathTwo)).then((rows) => {
    var orderLineRows = [];
    var orderLineIdRequests = [];

    var count = 0;
    var requests = [];
    rows.forEach(row => {
      if(parseInt(row[0]) == parseInt(orderNumber)){
        var sku = skuConvertion.find(s => s.old == row[2]) ? skuConvertion.find(s => s.old == row[2]).new.toUpperCase() : null;
        var isSuccess = true;
        if(sku){
          // var orderLine = {};
          orderLineIdRequests.push({
            method: 'GET',
            id: 'itemID_' + count,
            url: process.env.COMPANIES_API_PART+"/items?$filter=number eq '" + sku + "'&$select=id,number",
            headers: {
              "Content-Type": "application/json"
            }
          });
          count++;
          row[2] = sku;
          orderLineRows.push(row)
          // orderLine.documentId = orderID;
          // orderLine.itemId = await axios.get(env.BASIC_API_PATH+"/items?$filter=number eq '" + sku + "'&$select=id,number", {
          //   auth: {
          //   username: process.env.TOKEN_USER,
          //   password: process.env.TOKEN_KEY
          // }});

          // if(orderLine.itemId){
          //   orderLine.
          // }
          // else
          //   isSuccess = false;
        }
        else
          isSuccess = false;
        
        if(!isSuccess){
          console.log("Orderline with oldSKU of: " + row[2] + " and order number of: " + row[0] + " encountered an error");
        }
      }
      
    });
    var requests = {requests: orderLineIdRequests};
    return axios.post(process.env.BASIC_API_PATH+"$batch", requests, {
      auth: {
          username: process.env.TOKEN_USER,
          password: process.env.TOKEN_KEY
      }}).then(resp => {
        return {response: resp, orderLineRows: orderLineRows, orderID: orderID}
      });
  })
  .then(data => {
    var skuIdPairs = [];
    var orderLinePostRequests = [];
    if(data && data.response && data.response.data && data.response.data.responses && data.orderLineRows && data.orderID){
      data.response.data.responses.forEach(resp => {

        if(resp.status == 200){
          skuIdPairs.push({sku: resp.body.value[0].number.toString(), id: resp.body.value[0].id})
          console.log(resp.body.value[0]);
        }
        else{
          console.log('__________________');
          console.log(resp);
        }
      });
      var count = 0;
      data.orderLineRows.forEach(orderLineRow => {
        var orderLine = {};
        for (let index = 0; index < skuIdPairs.length; index++) {
          const element = skuIdPairs[index];
          console.log(element);
        }
        orderLine.itemId = skuIdPairs.find(sip => sip.sku == orderLineRow[2]) ? skuIdPairs.find(sip => sip.sku == orderLineRow[2].toString()).id : null;
        if(orderLine.itemId){
          orderLine.lineType = "Item";
          orderLine.quantity = orderLineRow[4];
          orderLine.unitPrice =  orderLineRow[5]
          orderLine.discountAmount = orderLineRow[6];
          orderLinePostRequests.push({
            method: "POST",
            id: "orderLineRequestID_" + count,
            url: process.env.COMPANIES_API_PART+"/salesOrders("+data.orderID+")/salesOrderLines",
            body: orderLine,
            headers: {
              "Content-Type": "application/json"
            }
          })
          count++;
        }
      });
      var requests = {
        requests: orderLinePostRequests
      };
      console.log("___________________");
      console.log(requests);
      return axios.post(process.env.BASIC_API_PATH+"$batch", requests, {
        auth: {
          username: process.env.TOKEN_USER,
          password: process.env.TOKEN_KEY
        },
        headers: {
          "Content-Type": "application/json;IEEE754Compatible=true"
        }}).then(resp => {
          if(resp.status != 200 && resp.status != 201){
            console.log(resp);
          }
        // console.log('_____________________________');
        // console.log(resp);
        if(resp.data && resp.data.responses){
          resp.data.responses.forEach(e => {
            // console.log(e);
          });
        }
      })
    }
  })
  .catch(err => console.log(err));
}

async function sendOrderToBC(order){
  return axios.post(process.env.CUSTOM_ORDER_API_PATH, order,
    {auth: {
      username: process.env.TOKEN_USER,
      password: process.env.TOKEN_KEY
  }})
  .then(response => {
    return response;
  })
  .catch(err => console.log(err));
  // var request = {
  //   method: "POST",
  //   url: process.env.CUSTOM_ORDER_API_PATH,
  //   credentials: "include",
  //   protocol: "https:",
  //   host: 

  // }
}
function sendOrderlinesToBC(orderlines){

}

function getCountryCodeByCountry(country){
  console.log("______");
  console.log(country);
  var result = "";
  for (const [key, value] of Object.entries(countries)) {
    console.log(`${key}: ${value}`);
    value.forEach(cname => {
      if(cname == country)
        result = key;
    });
    if(result != "")
      break;
  }
  console.log(result);
}