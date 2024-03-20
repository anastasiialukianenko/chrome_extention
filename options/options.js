async function validateApiKey(apiKey) {
  try {
    const response = await fetch('https://europe-central2-mehub-cz.cloudfunctions.net/api-v1/customers?size=100', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Ellity-Token': apiKey
      }
    });
    if (response.ok) {
      return true;
    }
    console.log(response)
    return false; 
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}


document.getElementById('save').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value;
  
  const isValid = await validateApiKey(apiKey);
  const saveMessage = document.querySelector('.saveMessage');

  if (isValid) {
    chrome.storage.sync.set({ apiKey }, () => {
      saveMessage.textContent = 'API Key byl úspěšně změněn.';
      saveMessage.style.display = 'block';
      saveMessage.style.color = 'green';
    });
  } else {
    saveMessage.textContent = 'Neplatný API Key.';
    saveMessage.style.display = 'block';
    saveMessage.style.color = 'red';
  }

  setTimeout(() => {
    saveMessage.style.display = 'none';
  }, 3000);
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('apiKey', (data) => {
    document.getElementById('apiKey').value = data.apiKey || '';
  });
});

  