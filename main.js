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
var skuConvertion = [];
var customerConvertion = [];
var shipmentCodes = [];
var failedOrders = [];
var failedOrderLines = [];
var isPendingCancel = false;

ipcMain.on('sendsaveddata', () => {
  sendSavedData();
})

function sendSavedData () {
  storage.getAll((error, data) => { 
    globalData = data;
    win.webContents.send('fetchedstorage', JSON.stringify(data));
  })
}
function sendCompleted () {
  win.webContents.send('completeddata', JSON.stringify({
    failedOrders: failedOrders
  }))
}

ipcMain.on('setorderstart', (event, number) => {
  storage.set('latestOrderNumber', number);
  sendSavedData();
})

ipcMain.on('uploadfile', (event, filenumber) => {
  dialog.showOpenDialog({ properties: ['openFile'] }).then((file) => {
    if(file && file.filePaths && file.filePaths[0]){
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

ipcMain.on('canceltransfer', async (event) => {
  isPendingCancel = true;
});
ipcMain.on('starttransfer', async (event) => {
  console.log(globalData);
  
  var gotShipmentmethods = await getShipmentMethods();
  var gotCustomerConvertion = await getCustomerConvertion();
  var gotSkuConvertion = await getSkuConvertion();
  var orders = [];
  const completed = readXlsxFile(fs.createReadStream(globalData.filePathOne))
    .then((rows) => {
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
        
        if(isB2B && row[43] && row[13]){
          order.extraWorkDelivery = {price: row[43], isDenmark: row[9] == "Danmark"}
        }

        order.phoneNumber = row[11];
        order.email = row[64];
        // order.notes = '';
        // order.paymentProvider = '';
        // order.paymentReference = '';
        order.externalDocumentNumber = row[0]
        
        if(!isB2B)
          order.paymentTermsId = '1155bbb9-cf25-ec11-8f47-000d3adca83b';
        // CHECK FREIGHTFORWARDER ETC (er lige nu DDP, EXW, DAP eller tom)
        
        // ALSO FIND PAYMENT TYPE AND order.currencyCode
        order.currencyCode = row[19] == "US$" ? "USD" : row[19];
        order.grossWeight = row[76];

        if(row[22] && shipmentCodes.find(sc => sc.code == row[22])){
          order.shipmentMethodId = shipmentCodes.find(sc => sc.code == row[22]).id;
        }

        orders.push(order);
      });
      orders.sort(function(a, b) {
        return parseFloat(a.id) - parseFloat(b.id);
      });
      return orders;
    })
    .then((result) => {
      return sendOrdersToBC(result);
    })
    .then((result) => {
      return true;
    })
    .catch((err) => {
      console.log(err);
    })
});

async function sendOrdersToBC(orders){
  failedOrders = [];
  for (let index = 0; index < orders.length; index++) {
    if(isPendingCancel){
      index = orders.length;
      isPendingCancel = false;
    }
    else{
      var order = orders[index];
      if(order){
        var currentNumber = order.id
        var extraWorkDelivery = order.extraWorkDelivery ? order.extraWorkDelivery : null;
        if(order.extraWorkDelivery)
          delete order.extraWorkDelivery
        // currentlyHandledOrderNumber = currentNumber;
        delete order.id;
        var response = await sendOrderToBC(order);
        if((response.status != 201 && response.status != 200) || !response || !response.data || !response.data.id){
          order.id = currentNumber
          failedOrders.push(order.id);
        }
        var orderLines = await getOrderLinesByOrderID(currentNumber, response.data.id, extraWorkDelivery);
        //insert logic
        console.log("success - " + currentNumber);
        storage.set('latestOrderNumber', currentNumber);
        globalData.latestOrderNumber = currentNumber;
        sendSavedData();
        // currentlyHandledOrderNumber = 0;
      }
    }
  }
  sendCompleted();

  return true;
}
// async function getOrderID()

async function getOrderLinesByOrderID(orderNumber, orderID, extraWorkDelivery){
  return readXlsxFile(fs.createReadStream(globalData.filePathTwo)).then((rows) => {
    var orderLineRows = [];
    var orderLineIdRequests = [];

    var count = 0;
    var requests = [];
    if(extraWorkDelivery){
      var extraWorkSku = extraWorkDelivery.isDenmark ? 'FREIGHT B2B DK' : 'FREIGHT B2B EU';
      orderLineIdRequests.push({
        method: 'GET',
        id: 'itemID_' + count,
        url: process.env.COMPANIES_API_PART+"/items?$filter=number eq '" + extraWorkSku + "'&$select=id,number",
        headers: {
          "Content-Type": "application/json"
        }
      });
      count++;
      var newRow = [parseInt(orderNumber), '', extraWorkSku, '', 1, extraWorkDelivery.price, null];
      orderLineRows.push(newRow);
    }
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
        }
        else
          isSuccess = false;
        
        if(!isSuccess){
          failedOrderLines.push({orderNumber: row[0], oldSku: row[2]});
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
        }
      });
      var count = 0;
      data.orderLineRows.forEach(orderLineRow => {
        var orderLine = {};
        for (let index = 0; index < skuIdPairs.length; index++) {
          const element = skuIdPairs[index];
        }
        orderLine.itemId = skuIdPairs.find(sip => sip.sku == orderLineRow[2]) ? skuIdPairs.find(sip => sip.sku == orderLineRow[2].toString()).id : null;
        if(orderLine.itemId){
          orderLine.lineType = "Item";
          orderLine.quantity = orderLineRow[4];
          orderLine.unitPrice =  orderLineRow[5];
          if(orderLineRow[6] && orderLine.quantity && orderLine.unitPrice){
            orderLine.discountAmount = (orderLine.quantity*orderLine.unitPrice)*(orderLineRow[6]/100);
          }
          
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
      return axios.post(process.env.BASIC_API_PATH+"$batch", requests, {
        auth: {
          username: process.env.TOKEN_USER,
          password: process.env.TOKEN_KEY
        },
        headers: {
          "Content-Type": "application/json;IEEE754Compatible=true"
        }})
        .then(resp => {
          if(resp.status != 200 && resp.status != 201){
            console.log(resp);
          }
          return true;
        })
        .catch(err => console.log(err));
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
async function getShipmentMethods(){
  return axios.get(process.env.BASIC_API_PATH+process.env.COMPANIES_API_PART+'/shipmentMethods', {
    auth: {
      username: process.env.TOKEN_USER,
      password: process.env.TOKEN_KEY
  }})
  .then((result) => {
    if(result && (result.status == 200 || result.status == 201) && result.data && result.data.value){
        shipmentCodes = [];
        result.data.value.forEach(shipmentCode => {
          shipmentCodes.push({code: shipmentCode.code, id: shipmentCode.id});
        });
        return true;
    }
    else
      return false;
  }).catch(err => console.log(err));
}

async function getCustomerConvertion(){
  return readXlsxFile(fs.createReadStream("./customerConvertion.xlsx"))
  .then((rows) => {
    customerConvertion = [];
    rows.forEach(row => {
      customerConvertion.push({old: row[0], new: row[1]});
    })
    return true;
  })
  .catch(err => console.log(err));
}

async function getSkuConvertion(){
  return readXlsxFile(fs.createReadStream("./skuConvertion.xlsx"))
  .then((rows) => {
    skuConvertion = [];
    rows.forEach(row => {
      skuConvertion.push({old: row[0], new: row[2]});
    })
    return true;
  })
  .catch(err => console.log(err));
}