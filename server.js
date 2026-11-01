const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

app.post('/api/search', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    let url = '';

    if (latitude && longitude) {
      // Busca por GPS (50km) - Boates, Bares e Clubes
      url = `https://api.geoapify.com/v2/places?categories=entertainment.nightclub,catering.bar,catering.pub,entertainment&filter=circle:${longitude},${latitude},50000&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
    } else if (query) {
      // Busca por texto da cidade + termos de entretenimento
      const termo = encodeURIComponent(`${query} nightclub bar`);
      url = `https://api.geoapify.com/v2/places?text=${termo}&filter=rect:-74.0,-33.0,-34.0,5.0&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
    } else {
      return res.status(400).json({ error: 'Digite um local para pesquisar.' });
    }

    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.features || data.features.length === 0) {
       return res.json({ places: [] });
    }

    const places = data.features.map(f => {
      const props = f.properties;
      return {
        placeId: props.place_id || String(props.datasource?.raw?.osm_id || Math.random()),
        name: props.name || 'Local sem nome',
        address: props.formatted || 'Endereço não informado',
        phone: props.contact?.phone || 'Telefone não informado',
        rating: null,
        userRatingsTotal: 0,
        photoUrl: null,
        website: props.website || null,
        googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lon}`,
        lat: props.lat,
        lng: props.lon,
        distance: null,
        pageUrl: null 
      };
    });

    res.json({ places });
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ error: 'Erro ao pesquisar estabelecimentos.' });
  }
});

app.post('/api/create-page', async (req, res) => {
    res.json({ pageUrl: "https://aperdicao.blogspot.com" });
});

module.exports = app;
