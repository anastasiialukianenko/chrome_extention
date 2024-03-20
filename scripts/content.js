const fetchJSON = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
};

// Checks if the current page is a Shoptet page
const isShoptetPage = () => document.querySelector('meta[name="author"]')?.content === 'Shoptet.cz';

// Fetches customer data based on email
const fetchCustomerData = async (email) => {
  const data = await new Promise((resolve, reject) => {
    chrome.storage.sync.get('apiKey', (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve(data.apiKey);
        removeBonusDiv();
      }
    });
  });

  const ELLITY_TOKEN = data;

  const url = `https://europe-central2-mehub-cz.cloudfunctions.net/api-v1/customers?size=100&filter=${encodeURIComponent(email)}`;
  return fetchJSON(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Ellity-Token': ELLITY_TOKEN 
    }
  }
  );
};
function resetLocalStorage(){
  const discountData = {
    discount: 0, 
    usedPoints: 0,
    email: null
  };
  localStorage.setItem('discountData', JSON.stringify(discountData));
}
// Function to remove the bonus div from the DOM
function removeBonusDiv() {
  const bonusDiv = document.querySelector('.customer-div');
  if (bonusDiv) {
    bonusDiv.parentNode.removeChild(bonusDiv);
  }
}
// Calculates discount value for a customer
const calculateDiscountValue = async (id, points, currency, price) => {
  const data = await new Promise((resolve, reject) => {
    chrome.storage.sync.get('apiKey', (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve(data.apiKey); 
      }
    });
  });

  const ELLITY_TOKEN = data;

  const url = `https://europe-central2-mehub-cz.cloudfunctions.net/api-v1/customers/${id}/discount`;
  return fetchJSON(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'X-Ellity-Token': ELLITY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ points, currency, price })
  });
};

const sendUsedPoints = async (requestBody) => {
  const data = await new Promise((resolve, reject) => {
    chrome.storage.sync.get('apiKey', (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve(data.apiKey); 
      }
    });
  });

  const ELLITY_TOKEN = data;
  const url ='https://europe-central2-mehub-cz.cloudfunctions.net/api-v1/customers/batch-import'
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ellity-Token': ELLITY_TOKEN 
    },
    body: JSON.stringify(requestBody)
  });
};

// Inserts customer details into the DOM
const insertCustomerDetails = (customer, account, usedPoints) => {
  const htmlContent = `
    <div class='customer-div'>
      <ul class='customer-list'>
        <li class='customer-item'>
          <p class='customer-bonus_title'>Body zakaznika</p>
          <p class='customer-bonus_value'>${account}</p>
        </li>
        <li class='customer-item'>
          <p class='customer-bonus_title'>Body k uplatnění</p>
          <input value="${usedPoints}" class='customer-bonus_input' type="number" name="points" id="points" min="1" max="${account}">
        </li>
      </ul>
      <button class='customer-bonus_button' disabled>Aplikovat slevu</button>
    </div>
  `;
  customer.insertAdjacentHTML("beforebegin", htmlContent);
};

// Toggles the button state based on input values
const toggleButtonState = (button, input, maxPoints) => {
  const points = parseInt(input.value, 10) || 0;
  const finalPriceElement = document.querySelector('.recipient-final-price');
  const priceMatch = finalPriceElement.textContent.match(/\d+/);
  const price = priceMatch ? parseInt(priceMatch[0], 10) : null;
  button.disabled = points <= 0 || points > maxPoints || price === 0;
  button.classList.toggle('disabled-button', button.disabled);
};

// Displays an error message near the specified element
const showError = (element, message) => {
  let error = document.querySelector('.error-message');
  if (!error) {
    error = document.createElement('p');
    error.className = 'error-message';
    error.style.color = 'red';
    element.insertAdjacentElement('afterend', error);
  }
  error.textContent = message;
};

// Applies discount based on customer input
const applyDiscount = async (customerId, pointsInput, email) => {
  const applyButton = document.querySelector('.customer-bonus_button');
  const finalPriceElement = document.querySelector('.recipient-final-price');

  if (!finalPriceElement) {
    console.error('Final price element not found.');
    return;
  }

  const points = parseInt(pointsInput.value, 10);
  const priceMatch = finalPriceElement.textContent.match(/\d+/);
  const price = priceMatch ? parseInt(priceMatch[0], 10) : null;
  const currency = 'czk';

  try {
    const discountData = await calculateDiscountValue(customerId, points, currency, price);
    if (price === null) {
      console.error('Invalid price format or price not found.');
      return;
    }

    if (discountData.discount > price) {
      showError(applyButton, 'Sleva nesmí překročit celkovou cenu.');
      return;
    }

    document.getElementById('discountValue').value = discountData.discount;
    localStorage.setItem('discountData', JSON.stringify({ ...discountData, email }));
    document.querySelector('.additional-content-submit').click();
  } catch (error) {
    showError(applyButton, 'Chyba při uplatnění slevy.');
    console.error('There was an error!', error);
  }
};

// Sets up event listeners for user interactions
const setupEventListeners = (pointsInput, applyButton, account, customerId, email) => {
  pointsInput.addEventListener('input', () => toggleButtonState(applyButton, pointsInput, account));
  applyButton.addEventListener('click', () => applyDiscount(customerId, pointsInput, email));
};

// Generates a unique idempotency key
function generateIdempotencyKey() {
  return `unique-key-${Date.now()}`;
}
if (isShoptetPage()) {
  const customerElement = document.querySelector(".cashdesk-search-wrapper");

  // const customerElement = document.querySelector(".cashdesk-content");
  const emailElement = document.querySelector('.customer-content a strong');
  const paymentButton = document.querySelector('.recipient-summary-inner-box button');

  if (emailElement) {
    const email = emailElement.textContent;
     // Send the email to the background script
     chrome.runtime.sendMessage({email: email});

    const discountDataStr = localStorage.getItem('discountData');
    const discountData = JSON.parse(discountDataStr);
    const usedPoints = discountData.usedPoints;
    const usedEmail = discountData.email;
  
    fetchCustomerData(email).then(data => {
      if (data.items.length > 0) {
        const customerId = data.items[0].id;
        const account = data.items[0].account  - usedPoints;
        insertCustomerDetails(customerElement, account, usedPoints);
        const applyButton = document.querySelector('.customer-bonus_button');
        const pointsInput = document.querySelector('.customer-bonus_input');
        setupEventListeners(pointsInput, applyButton, account, customerId, email);
      }
    }).catch(console.error);

    if (paymentButton && usedEmail){
      paymentButton.addEventListener('click', async () => {
    const requestBody = {
      entries: [
        {
          email: email,
          change: usedPoints,
          action: "discharge",
          note: "Pokladna",
          idempotencyKey: generateIdempotencyKey()
        }
      ]
    };
  try {
    sendUsedPoints(requestBody)
    } catch (error) {
      console.error('Failed to send used points data:', error);
    }
    resetLocalStorage();
    removeBonusDiv();
    })}
  } else{
    resetLocalStorage();
    removeBonusDiv();
  }
    document.body.addEventListener('click', (event) => {
      if (event.target.matches('.item-action-delete.full')) {
        resetLocalStorage();
      }
    });

}



