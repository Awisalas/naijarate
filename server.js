const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ROUTE: Get exchange rates
app.get('/api/rates', async (req, res) => {
  try {
    const API_KEY = process.env.EXCHANGE_API_KEY;
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`
    );
    const data = await response.json();

    if (data.result !== 'success') {
      return res.status(500).json({ error: 'API call failed' });
    }

    const rates = {
      USD_NGN: data.conversion_rates.NGN,
      GBP_NGN: (data.conversion_rates.NGN / data.conversion_rates.GBP),
      EUR_NGN: (data.conversion_rates.NGN / data.conversion_rates.EUR),
      CAD_NGN: (data.conversion_rates.NGN / data.conversion_rates.CAD),
      last_updated: data.time_last_update_utc
    };

    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`NaijaRate server running on http://localhost:${PORT}`);
});
