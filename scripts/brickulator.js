'use strict';
var BC = BC || {};
let setDB;

const ebaySellingFeePercentage = .13, // TODO: Get this from a lookup
      oneMinute = 60000, // in milliseconds
      threeMinutes = oneMinute * 3, // in milliseconds
      oneHour = oneMinute * 60; // in milliseconds

BC.Utils = function() {
  const formatCurrency = function formatCurrency(number) {
    return number.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  const getBrickOwlSellerFees = function getBrickOwlSellerFees(finalValue) {
    const brickOwlCommissionPercent = 2.5,
          fee = (brickOwlCommissionPercent / 100) * finalValue;
    return fee;
  }

  return {
    formatCurrency: formatCurrency,
    getBrickOwlSellerFees: getBrickOwlSellerFees
  }
}();

BC.SetDatabase = function() {
  const loadingSpinner = document.querySelector(".bc-spinner--loading-set-data"),
        loadingSpinnerVisibleClass = "bc-spinner--visible",
        setDataCachedMessage = document.querySelector(".bc-lookup-set-data-status-message"),
        setDataCachedMessageHiddenClass = "bc-lookup-set-data-status-message--hidden",
        currentDomain = window.location.hostname,
        apiMapping = {
          'localhost': 'http://localhost:5000',
          'kevinmpowell.github.io': 'https://brickulator-api.herokuapp.com'
        };
  function saveSetDBToLocalStorage(rawJSON) {
    localStorage.clear();
    localStorage.setItem("BCSetDB", rawJSON);
  }

  function showLoadingSpinner() {
    loadingSpinner.classList.add(loadingSpinnerVisibleClass);
    setDataCachedMessage.classList.add(setDataCachedMessageHiddenClass);
  }

  function hideLoadingSpinner() {
    loadingSpinner.classList.remove(loadingSpinnerVisibleClass);
    setDataCachedMessage.classList.remove(setDataCachedMessageHiddenClass);
  }

  const retrieveFreshSetData = function retrieveFreshSetData() {
    var request = new XMLHttpRequest();
    const apiDomain = apiMapping[currentDomain];

    showLoadingSpinner();
    try {
      request.open('GET', apiDomain + '/lego_sets', true);
      request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          // Success!
          var data = JSON.parse(request.responseText);
          data.dataRetrieved = Date.now();
          saveSetDBToLocalStorage(JSON.stringify(data));
          setDB = data;
          BC.Autocomplete.updateDataset(setDB);
          hideLoadingSpinner();
          updateSetDataTimestamp(setDB.dataRetrieved);
          BC.Overlay.hide();
        } else {
          // We reached our target server, but it returned an error
          // alert("Could not retrieve set data - connection successful, but data failed");
          if (setDB !== null) {
            // If we've got localStorage data we're in good shape, move along
            updateSetDataTimestamp(setDB.dataRetrieved);
          } else {
            // No local storage data and data retrieval failed.
            BC.Overlay.show("Oh Noes!", "Something went wrong on our end. It's us, not you. We'll get on that right away.");
            // TODO: Notify someone!
          }
          hideLoadingSpinner();
        }
      };

      request.onerror = function() {
        // There was a connection error of some sort
        // alert("Could not retrieve set data - connection error");
        if (setDB !== null) {
          // If we've got localStorage data we're in good shape, move along
          updateSetDataTimestamp(setDB.dataRetrieved);
        } else {
          // No local storage data and data retrieval failed.
          BC.Overlay.show("Oh Noes!", "Something went wrong on our end. It's us, not you. We'll get on that right away.");
          // TODO: Notify someone!
        }
        hideLoadingSpinner();
      };

      request.send();
    } catch (e) {
      // console.log(e);
      if (setDB !== null) {
        // Something went wrong with the data request, but we've got localStorage data, so move along
        updateSetDataTimestamp(setDB.dataRetrieved);
        BC.Overlay.hide();
      }
      hideLoadingSpinner();
    }
  }

  function updateSetDataTimestamp(timestamp) {
    document.querySelector(".bc-lookup-set-data-timestamp").setAttribute("datetime", timestamp);
    timeago().render(document.querySelectorAll('.bc-lookup-set-data-timestamp'));
  }

  const initialize = function initialize() {
    setDB = localStorage.getItem("BCSetDB");
    setDB = JSON.parse(setDB);
    if (setDB === null) {
      // If there's no data to work with, put up the overlay so the form can't be used
      BC.Overlay.show("Sit Tight.", "We're getting the freshest set values just for you!")
    }
    // if (1 === 1) {
    if (setDB === null || typeof setDB.dataRetrieved === 'undefined' || (Date.now() - setDB.dataRetrieved) > oneHour ) { // If it's been more than an hour get fresh data
      retrieveFreshSetData();
    } else {
      updateSetDataTimestamp(setDB.dataRetrieved);
    }
  }

  return {
    initialize: initialize,
    retrieveFreshSetData: retrieveFreshSetData
  };
}();

BC.Values = function() {
  const setTitleFieldId = "bc-results__set-title",
        ebayAvgFieldId = "ebay-avg",
        ebaySellingFeesFieldId = "ebay-selling-fees",
        ebayPurchasePriceFieldId = "ebay-purchase-price",
        ebayProfitFieldId = "ebay-profit",
        showLookupFormClass = "bc-show-lookup-form";

  function calculate(setNumber, purchasePrice) {
    const setData = setDB[setNumber];
    // BC.PortletPricePerPiece.update(setData, purchasePrice);
    // BC.PortletPartOutBrickOwl.update(setData, purchasePrice);

    if (setData) {
      BC.SetSummary.update(setData);
      BC.PortletLayout.updateAllPortletValues(setData, purchasePrice);

      showValues();
    } else {
      alert("Set Number Not Found")
    }
  }

  function showValues() {
    document.body.classList.add("bc--show-values");
  }

  function hideValues() {
    document.body.classList.remove("bc--show-values");
  }

  function handleShowLookupFormClick(e) {
    e.preventDefault();
    hideValues();
  }

  function addEventListeners() {
    const showLookupFormTriggers = Array.from(document.querySelectorAll(`.${showLookupFormClass}`));

    showLookupFormTriggers.forEach(function(t){
      t.addEventListener("click", handleShowLookupFormClick);
    });
  }

  function initialize() {
    addEventListeners();
  }

  return {
    calculate: calculate,
    initialize: initialize
  }
}();

BC.Form = function() {
  const formId = "bc-value-lookup-form",
        setNumberFieldId = "bc-value-lookup-form__set-number-input",
        purchasePriceFieldId = "bc-value-lookup-form__purchase-price-input";

  function handleFormSubmit(e) {
    e.preventDefault();
    const setNumber = document.getElementById(setNumberFieldId).value,
          purchasePrice = document.getElementById(purchasePriceFieldId).value;
    BC.Values.calculate(setNumber, purchasePrice);
  }

  function setEventListeners() {
    const form = document.getElementById(formId);
    form.addEventListener("submit", handleFormSubmit);
  }


  let initialize = function initialize() {
    setEventListeners();
  };

  return {
    initialize: initialize
  }
}();



function ready(fn) {
  if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading"){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function(){
  BC.Overlay.initialize();
  BC.SetDatabase.initialize();
  BC.Form.initialize();
  BC.Values.initialize();
  BC.SetSummary.initialize();
  BC.PortletLayout.initialize();
  BC.PortletLayout.buildLayout();
});
