/**
 * Google Apps Script for "dukon Laziz" Telegram Bot Backend
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions -> Apps Script.
 * 3. Delete any existing code and paste this code.
 * 4. Click Deploy -> New Deployment.
 * 5. Choose Select type -> Web app.
 * 6. Set Description: "dukon Laziz API"
 * 7. Set Execute as: "Me"
 * 8. Set Who has access: "Anyone"
 * 9. Click Deploy (Authorize permissions when prompted).
 * 10. Copy the Web app URL and paste it in your `.env` file as `GOOGLE_SCRIPT_URL`.
 */

function doGet(e) {
  try {
    initializeSheet();
    var action = e.parameter.action;
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!action) {
      return jsonResponse({ success: false, error: "Missing action parameter" });
    }
    
    if (action === "checkPhone") {
      var phone = e.parameter.phone;
      return jsonResponse(checkPhone(sheet, phone));
    }
    
    if (action === "getProducts") {
      return jsonResponse(getProducts(sheet));
    }
    
    if (action === "getHistory") {
      var productId = e.parameter.productId;
      var phone = e.parameter.phone;
      return jsonResponse(getHistory(sheet, productId, phone));
    }
    
    if (action === "getDebts") {
      var productId = e.parameter.productId;
      var phone = e.parameter.phone;
      return jsonResponse(getDebts(sheet, productId, phone));
    }
    
    if (action === "getAllUsers") {
      return jsonResponse(getAllUsers(sheet));
    }
    
    return jsonResponse({ success: false, error: "Invalid GET action: " + action });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function doPost(e) {
  try {
    initializeSheet();
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!action) {
      return jsonResponse({ success: false, error: "Missing action in POST body" });
    }
    
    if (action === "recordPurchase") {
      return jsonResponse(recordPurchase(sheet, postData.data));
    }
    
    if (action === "payDebt") {
      return jsonResponse(payDebt(sheet, postData.data));
    }
    
    if (action === "addAllowedPhone") {
      return jsonResponse(addAllowedPhone(sheet, postData.data));
    }
    
    if (action === "deleteAllowedUser") {
      return jsonResponse(deleteAllowedUser(sheet, postData.data));
    }
    
    if (action === "updatePurchase") {
      return jsonResponse(updatePurchase(sheet, postData.data));
    }
    
    if (action === "deletePurchase") {
      return jsonResponse(deletePurchase(sheet, postData.data));
    }
    
    return jsonResponse({ success: false, error: "Invalid POST action: " + action });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// Helper to return JSON response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Automatically creates sheets and column headers if they don't exist
function initializeSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. AllowedUsers Sheet
  var allowedUsersSheet = ss.getSheetByName("AllowedUsers");
  if (!allowedUsersSheet) {
    allowedUsersSheet = ss.insertSheet("AllowedUsers");
    allowedUsersSheet.appendRow(["Phone", "Name", "Status"]);
    // Append some example default number (change as needed)
    allowedUsersSheet.appendRow(["+998991234567", "Laziz Owner", "Active"]);
  }
  
  // 2. Products Sheet
  var productsSheet = ss.getSheetByName("Products");
  if (!productsSheet) {
    productsSheet = ss.insertSheet("Products");
    productsSheet.appendRow(["Id", "Name"]);
    productsSheet.appendRow(["p1", "Product One"]);
    productsSheet.appendRow(["p2", "Product Two"]);
    productsSheet.appendRow(["p3", "Product Three"]);
    productsSheet.appendRow(["p4", "Product Four"]);
  }
  
  // 3. Purchases Sheet
  var purchasesSheet = ss.getSheetByName("Purchases");
  if (!purchasesSheet) {
    purchasesSheet = ss.insertSheet("Purchases");
    purchasesSheet.appendRow([
      "Id", "ProductId", "Date", "QuantityKg", "PricePerKg", 
      "TotalPrice", "AmountPaid", "RemainingDebt", "Status", "Phone"
    ]);
  }
  
  // 4. Payments Sheet
  var paymentsSheet = ss.getSheetByName("Payments");
  if (!paymentsSheet) {
    paymentsSheet = ss.insertSheet("Payments");
    paymentsSheet.appendRow(["Id", "PurchaseId", "Date", "AmountPaid", "Phone"]);
  }
}

// Clean and format phone number for standardized comparison (removes spaces, symbols, plus sign)
function cleanPhoneNumber(phone) {
  if (!phone) return "";
  var cleaned = String(phone).replace(/[\s\-\(\)\+]/g, "");
  // If local 9-digit format, standardize to Uzbekistan format
  if (cleaned.length === 9) {
    cleaned = "998" + cleaned;
  }
  return cleaned;
}

// Check if a phone number is authorized
function checkPhone(ss, phone) {
  if (!phone) return { allowed: false, error: "Phone number is required" };
  
  var cleanPhone = cleanPhoneNumber(phone);
  var sheet = ss.getSheetByName("AllowedUsers");
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var userPhone = cleanPhoneNumber(data[i][0]);
    if (userPhone === cleanPhone) {
      var name = data[i][1];
      var status = data[i][2];
      if (status.toLowerCase() === "active") {
        return { allowed: true, name: name, phone: phone };
      }
    }
  }
  
  return { allowed: false, phone: phone };
}

// Get list of products
function getProducts(ss) {
  var sheet = ss.getSheetByName("Products");
  var data = sheet.getDataRange().getValues();
  var products = [];
  
  for (var i = 1; i < data.length; i++) {
    products.push({
      id: data[i][0],
      name: data[i][1]
    });
  }
  
  return { success: true, products: products };
}

// Get purchase history, optionally filtered by product and phone
function getHistory(ss, productId, phone) {
  var sheet = ss.getSheetByName("Purchases");
  var data = sheet.getDataRange().getValues();
  var history = [];
  var cleanQueryPhone = cleanPhoneNumber(phone);
  
  for (var i = 1; i < data.length; i++) {
    var pId = data[i][1];
    var userPhone = cleanPhoneNumber(data[i][9]);
    
    // Check filters if provided
    if (productId && pId !== productId) continue;
    if (cleanQueryPhone && userPhone !== cleanQueryPhone) continue;
    
    // Skip if marked as deleted in Column 11
    var isDeleted = data[i][10] ? String(data[i][10]).trim() : "";
    if (isDeleted === "Yes" || isDeleted === "Deleted") continue;
    
    history.push({
      id: data[i][0],
      productId: pId,
      date: data[i][2],
      quantityKg: Number(data[i][3]),
      pricePerKg: Number(data[i][4]),
      totalPrice: Number(data[i][5]),
      amountPaid: Number(data[i][6]),
      remainingDebt: Number(data[i][7]),
      status: data[i][8],
      phone: data[i][9]
    });
  }
  
  // Sort by date descending (assuming chronological order of entry, reverse it)
  history.reverse();
  
  return { success: true, history: history };
}

// Get outstanding debts, optionally filtered by product and phone
function getDebts(ss, productId, phone) {
  var sheet = ss.getSheetByName("Purchases");
  var data = sheet.getDataRange().getValues();
  var debts = [];
  var cleanQueryPhone = cleanPhoneNumber(phone);
  
  for (var i = 1; i < data.length; i++) {
    var pId = data[i][1];
    var userPhone = cleanPhoneNumber(data[i][9]);
    var remainingDebt = Number(data[i][7]);
    
    if (remainingDebt <= 0) continue; // Not a debt
    
    // Check filters
    if (productId && pId !== productId) continue;
    if (cleanQueryPhone && userPhone !== cleanQueryPhone) continue;
    
    // Skip if marked as deleted in Column 11
    var isDeleted = data[i][10] ? String(data[i][10]).trim() : "";
    if (isDeleted === "Yes" || isDeleted === "Deleted") continue;
    
    debts.push({
      id: data[i][0],
      productId: pId,
      date: data[i][2],
      quantityKg: Number(data[i][3]),
      pricePerKg: Number(data[i][4]),
      totalPrice: Number(data[i][5]),
      amountPaid: Number(data[i][6]),
      remainingDebt: remainingDebt,
      status: data[i][8],
      phone: data[i][9]
    });
  }
  
  debts.reverse(); // Newest debts first
  
  return { success: true, debts: debts };
}

// Record a new purchase
function recordPurchase(ss, item) {
  var sheet = ss.getSheetByName("Purchases");
  var id = "PURCH-" + Math.floor(Math.random() * 900000 + 100000);
  
  var quantity = Number(item.quantityKg);
  var price = Number(item.pricePerKg);
  var total = Number(item.totalPrice);
  var paid = Number(item.amountPaid);
  var debt = total - paid;
  
  var status = "Paid";
  if (debt > 0) {
    status = paid === 0 ? "Debt" : "Partially Paid";
  }
  
  var dateStr = Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd HH:mm");
  
  sheet.appendRow([
    id,
    item.productId,
    dateStr,
    quantity,
    price,
    total,
    paid,
    debt,
    status,
    item.phone
  ]);
  
  return { success: true, purchaseId: id, total: total, paid: paid, debt: debt, status: status };
}

// Pay off a debt
function payDebt(ss, item) {
  var purchasesSheet = ss.getSheetByName("Purchases");
  var paymentsSheet = ss.getSheetByName("Payments");
  
  var purchaseId = item.purchaseId;
  var payAmount = Number(item.amountPaid);
  var phone = item.phone;
  
  var data = purchasesSheet.getDataRange().getValues();
  var rowIdx = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === purchaseId) {
      rowIdx = i + 1; // 1-indexed and has header row
      break;
    }
  }
  
  if (rowIdx === -1) {
    return { success: false, error: "Purchase record not found: " + purchaseId };
  }
  
  // Current values
  var currentPaid = Number(purchasesSheet.getRange(rowIdx, 7).getValue());
  var currentDebt = Number(purchasesSheet.getRange(rowIdx, 8).getValue());
  var totalPrice = Number(purchasesSheet.getRange(rowIdx, 6).getValue());
  
  var newPaid = currentPaid + payAmount;
  var newDebt = currentDebt - payAmount;
  if (newDebt < 0) newDebt = 0; // prevent negative debt
  
  var newStatus = "Paid";
  if (newDebt > 0) {
    newStatus = newPaid === 0 ? "Debt" : "Partially Paid";
  }
  
  // Update Purchases sheet
  purchasesSheet.getRange(rowIdx, 7).setValue(newPaid);
  purchasesSheet.getRange(rowIdx, 8).setValue(newDebt);
  purchasesSheet.getRange(rowIdx, 9).setValue(newStatus);
  
  // Log payment transaction in Payments sheet
  var paymentId = "PAY-" + Math.floor(Math.random() * 900000 + 100000);
  var dateStr = Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd HH:mm");
  paymentsSheet.appendRow([paymentId, purchaseId, dateStr, payAmount, phone]);
  
  return { 
    success: true, 
    paymentId: paymentId, 
    newPaid: newPaid, 
    newDebt: newDebt, 
    status: newStatus 
  };
}

// Add an allowed phone number (admin feature or manual trigger)
function addAllowedPhone(ss, user) {
  var sheet = ss.getSheetByName("AllowedUsers");
  var cleanPhone = cleanPhoneNumber(user.phone);
  
  // Check if phone already exists
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var existingPhone = cleanPhoneNumber(data[i][0]);
    if (existingPhone === cleanPhone) {
      // Update name and status
      sheet.getRange(i + 1, 2).setValue(user.name);
      sheet.getRange(i + 1, 3).setValue("Active");
      return { success: true, message: "User phone updated", phone: user.phone };
    }
  }
  
  sheet.appendRow(["+" + cleanPhone, user.name, "Active"]);
  return { success: true, message: "User phone added", phone: user.phone };
}

// Get all allowed users (admin feature)
function getAllUsers(ss) {
  var sheet = ss.getSheetByName("AllowedUsers");
  var data = sheet.getDataRange().getValues();
  var users = [];
  
  for (var i = 1; i < data.length; i++) {
    users.push({
      phone: data[i][0],
      name: data[i][1],
      status: data[i][2]
    });
  }
  
  return { success: true, users: users };
}

// Delete an allowed user (admin feature)
function deleteAllowedUser(ss, user) {
  var sheet = ss.getSheetByName("AllowedUsers");
  var data = sheet.getDataRange().getValues();
  var cleanTargetPhone = cleanPhoneNumber(user.phone);
  
  for (var i = 1; i < data.length; i++) {
    var userPhone = cleanPhoneNumber(data[i][0]);
    if (userPhone === cleanTargetPhone) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "User deleted successfully" };
    }
  }
  
  return { success: false, error: "User not found" };
}

// Update purchase record details (admin feature)
function updatePurchase(ss, item) {
  var sheet = ss.getSheetByName("Purchases");
  var rows = sheet.getDataRange().getValues();
  var purchaseId = item.id;
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === purchaseId) {
      var oldQuantity = Number(rows[i][3]);
      var oldPrice = Number(rows[i][4]);
      var oldPaid = Number(rows[i][6]);

      var quantity = Number(item.quantityKg);
      var price = Number(item.pricePerKg);
      var total = Math.round(quantity * price);
      var paid = Number(item.amountPaid);
      var debt = total - paid;
      if (debt < 0) debt = 0;
      
      var status = "Paid";
      if (debt > 0) {
        status = paid === 0 ? "Debt" : "Partially Paid";
      }
      
      // Calculate and format modification log
      var timestamp = Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd HH:mm");
      var changes = [];
      if (oldQuantity !== quantity) changes.push("Weight: " + oldQuantity + "kg -> " + quantity + "kg");
      if (oldPrice !== price) changes.push("Price: " + oldPrice + " -> " + price);
      if (oldPaid !== paid) changes.push("Paid: " + oldPaid + " -> " + paid);
      
      var logMsg = "";
      if (changes.length > 0) {
        logMsg = "Changed by Admin on " + timestamp + ": " + changes.join(", ");
        var oldLog = rows[i][11] ? String(rows[i][11]) : "";
        if (oldLog) {
          logMsg = oldLog + " | " + logMsg;
        }
      }
      
      // Columns: 1=Id, 2=ProductId, 3=Date, 4=QuantityKg, 5=PricePerKg, 6=TotalPrice, 7=AmountPaid, 8=RemainingDebt, 9=Status, 10=Phone, 11=Deleted, 12=Log
      sheet.getRange(i + 1, 4).setValue(quantity);
      sheet.getRange(i + 1, 5).setValue(price);
      sheet.getRange(i + 1, 6).setValue(total);
      sheet.getRange(i + 1, 7).setValue(paid);
      sheet.getRange(i + 1, 8).setValue(debt);
      sheet.getRange(i + 1, 9).setValue(status);
      if (logMsg) {
        sheet.getRange(i + 1, 12).setValue(logMsg);
      }
      
      return { success: true, message: "Purchase updated successfully" };
    }
  }
  
  return { success: false, error: "Purchase record not found" };
}

// Delete purchase record (admin feature)
function deletePurchase(ss, data) {
  var sheet = ss.getSheetByName("Purchases");
  var rows = sheet.getDataRange().getValues();
  var purchaseId = data.id;
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === purchaseId) {
      var timestamp = Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd HH:mm");
      sheet.getRange(i + 1, 11).setValue("Yes");
      sheet.getRange(i + 1, 12).setValue("Deleted by Admin on " + timestamp);
      return { success: true, message: "Purchase marked as deleted successfully" };
    }
  }
  
  return { success: false, error: "Purchase record not found" };
}
